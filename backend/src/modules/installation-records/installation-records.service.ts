import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { scopeWhere, toScopeContext, ScopeContext } from 'src/common/utils/scope-filter.util';
import { SAFE_USER_SELECT } from 'src/common/utils/safe-user-select';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateInstallationRecordDto } from './dto/create-installation-record.dto';
import { UpdateInstallationRecordDto } from './dto/update-installation-record.dto';
import {
  MeterSimCardState,
  Prisma,
  InstallationRecord,
  InstallationRecordKind,
  RecordStatus,
  SimCardStatus,
  UserRole,
} from '@prisma/client';
import { assertMeterYearsRequired } from 'src/common/utils/meter-years.util';
import { InstallationRecordFilterDto } from './dto/installation-record-filter.dto';
import { PaginatedResult } from 'src/common/interfaces/paginated-result.interface';
import { RecordNumberGenerator } from 'src/common/utils/record-number.generator';
import { PdfGeneratorService } from 'src/common/utils/pdf-generator.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { MailService } from '../mail/mail.service';
import { MeterTypeFieldsService } from '../meter-type-definitions/meter-type-fields.service';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

export type InstallationRecordContext = {
  userId?: string;
  role?: UserRole;
  distributionId?: string | null;
  ipAddress?: string;
  /** branchId trenutnog korisnika – za operatora se postavlja na meter pri kreiranju novog brojila */
  branchId?: string | null;
  branchModeratorBranchIds?: string[];
};

@Injectable()
export class InstallationRecordsService {
  private readonly logger = new Logger(InstallationRecordsService.name);
  private readonly uploadsRoot: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly recordNumberGenerator: RecordNumberGenerator,
    private readonly pdfGenerator: PdfGeneratorService,
    private readonly activityLogService: ActivityLogService,
    private readonly mailService: MailService,
    private readonly meterTypeFieldsService: MeterTypeFieldsService,
    private readonly config: ConfigService,
  ) {
    this.uploadsRoot = this.config.get<string>(
      'UPLOAD_ROOT_PATH',
      path.join(process.cwd(), 'uploads'),
    );
  }

  private resolveUploadsPath(relativePath: string): string {
    const parts = relativePath.split(/[\\/]+/).filter(Boolean);
    return path.join(this.uploadsRoot, ...parts);
  }

  private sanitizePathSegment(value: string): string {
    return value.replace(/[^a-zA-Z0-9-_]/g, '_');
  }

  private getRecordYear(record: { createdAt?: Date | string | null }): string {
    const d = record.createdAt ? new Date(record.createdAt) : new Date();
    return String(d.getFullYear());
  }

  private getRecordBaseDir(record: {
    createdAt?: Date | string | null;
    meter?: { serialNumber?: string | null } | null;
  }): { year: string; serial: string; baseRelativeDir: string; baseAbsoluteDir: string } {
    const year = this.getRecordYear(record);
    const serialRaw = record.meter?.serialNumber?.trim() || 'unknown-meter';
    const serial = this.sanitizePathSegment(serialRaw);
    const baseRelativeDir = path.posix.join('installation-records', year, serial);
    const baseAbsoluteDir = this.resolveUploadsPath(baseRelativeDir);
    return { year, serial, baseRelativeDir, baseAbsoluteDir };
  }

  async create(
    createInstallationRecordDto: CreateInstallationRecordDto,
    ctx?: InstallationRecordContext,
  ): Promise<InstallationRecord> {
    if (createInstallationRecordDto.clientRequestId) {
      const existing = await this.prisma.installationRecord.findUnique({
        where: { clientRequestId: createInstallationRecordDto.clientRequestId },
      });
      if (existing) {
        return existing;
      }
    }

    const kind =
      createInstallationRecordDto.kind ?? InstallationRecordKind.NEW_CONNECTION;
    if (kind === InstallationRecordKind.NEW_CONNECTION && createInstallationRecordDto.demountedMeter) {
      throw new BadRequestException(
        'Polje demountedMeter nije dozvoljeno za zapisnik novog priključka.',
      );
    }
    if (kind === InstallationRecordKind.METER_REPLACEMENT && !createInstallationRecordDto.demountedMeter) {
      throw new BadRequestException('Za zamjenu brojila obavezno je polje demountedMeter.');
    }

    let demountedMeterSnapshot: Prisma.InputJsonValue | undefined;
    if (kind === InstallationRecordKind.METER_REPLACEMENT && createInstallationRecordDto.demountedMeter) {
      const dm = createInstallationRecordDto.demountedMeter;
      assertMeterYearsRequired(dm.year, dm.calibrationYear, 'demontirano brojilo');
      const demountedType = await this.prisma.meterTypeDefinition.findUnique({
        where: { id: dm.meterTypeDefinitionId },
      });
      if (!demountedType) {
        throw new BadRequestException('Tip demontiranog brojila nije pronađen.');
      }
      const validatedDemountedDynamic = await this.meterTypeFieldsService.validateDynamicValues(
        dm.meterTypeDefinitionId,
        dm.dynamicFieldValues ?? null,
      );
      demountedMeterSnapshot = {
        meterTypeDefinitionId: dm.meterTypeDefinitionId,
        serialNumber: dm.serialNumber.trim(),
        year: dm.year,
        calibrationYear: dm.calibrationYear,
        ...(Object.keys(validatedDemountedDynamic).length > 0 && {
          dynamicFieldValues: validatedDemountedDynamic,
        }),
        ...(dm.notes != null && dm.notes !== '' ? { notes: dm.notes } : {}),
        ...(dm.hadIntegratedSim !== undefined ? { hadIntegratedSim: dm.hadIntegratedSim } : {}),
        ...(dm.noSimNote != null && dm.noSimNote !== '' ? { noSimNote: dm.noSimNote } : {}),
      } as Prisma.InputJsonValue;
    }

    let effectiveInstalledById = createInstallationRecordDto.installedById;
    const actorScope = ctx?.role
      ? toScopeContext({
          role: ctx.role,
          distributionId: ctx.distributionId ?? null,
          branchId: ctx.branchId ?? null,
          branchModeratorBranchIds: ctx.branchModeratorBranchIds ?? [],
        })
      : null;

    if (ctx && ctx.role === UserRole.USER && ctx.userId) {
      effectiveInstalledById = ctx.userId;
    } else if (
      ctx &&
      ctx.role === UserRole.DIST_ADMIN &&
      createInstallationRecordDto.installedById &&
      createInstallationRecordDto.installedById !== ctx.userId
    ) {
      const targetScope = scopeWhere(actorScope, { userScope: true });
      const targetUser = await this.prisma.user.findFirst({
        where: {
          id: createInstallationRecordDto.installedById,
          ...(targetScope ? { AND: [targetScope] } : {}),
        },
        select: { id: true },
      });
      if (!targetUser) {
        throw new ForbiddenException('Odabrani monter nije u vašoj distribuciji.');
      }
    }

    const simCardId = createInstallationRecordDto.simCardId;
    const simScopeClause = actorScope ? scopeWhere(actorScope, { viaShipment: true }) : undefined;
    const simCard = await this.prisma.simCard.findFirst({
      where: {
        id: simCardId,
        ...(simScopeClause ? { AND: [simScopeClause] } : {}),
      },
    });
    if (!simCard) {
      throw new BadRequestException('SIM kartica nije pronađena ili nije u vašem opsegu.');
    }
    const canUseSim =
      simCard.status === SimCardStatus.AVAILABLE ||
      (simCard.status === SimCardStatus.ASSIGNED &&
        simCard.assignedToId === effectiveInstalledById);
    if (!canUseSim) {
      throw new BadRequestException('SIM kartica nije dostupna za ugradnju.');
    }

    let existingMeterSimCardId: string | null = null;
    let meterIdForLookup: string | null = null;
    let newMeterData:
      | {
          serialNumber: string;
          meterTypeDefinitionId: string;
          branchId?: string;
          year?: number;
          calibrationYear?: number;
          installationAddress?: string;
          installationDate?: Date;
          city?: string;
          municipality?: string;
          measuringPoint?: string;
          latitude?: number;
          longitude?: number;
          dynamicFieldValues?: Prisma.InputJsonValue;
        }
      | null = null;

    if (createInstallationRecordDto.meterId) {
      const meterScopeClause = actorScope
        ? scopeWhere(actorScope, { branchIdField: 'branchId' })
        : undefined;
      const existingMeter = await this.prisma.meter.findFirst({
        where: {
          id: createInstallationRecordDto.meterId,
          ...(meterScopeClause ? { AND: [meterScopeClause] } : {}),
        },
        select: { id: true, simCardId: true, status: true },
      });
      if (!existingMeter) {
        throw new BadRequestException('Brojilo nije pronađeno ili nije u vašem opsegu.');
      }
      if (existingMeter.status && existingMeter.status !== 'ACTIVE') {
        throw new BadRequestException('Brojilo nije aktivno; ugradnja SIM-a nije dozvoljena.');
      }
      meterIdForLookup = existingMeter.id;
      existingMeterSimCardId = existingMeter.simCardId;
    } else if (
      createInstallationRecordDto.meterTypeDefinitionId &&
      createInstallationRecordDto.serialNumber
    ) {
      const typeDef = await this.prisma.meterTypeDefinition.findUnique({
        where: { id: createInstallationRecordDto.meterTypeDefinitionId },
      });
      if (!typeDef) {
        throw new BadRequestException('Tip brojila nije pronađen.');
      }
      assertMeterYearsRequired(
        createInstallationRecordDto.year,
        createInstallationRecordDto.calibrationYear,
        'novo brojilo',
      );
      const existingBySerial = await this.prisma.meter.findUnique({
        where: { serialNumber: createInstallationRecordDto.serialNumber.trim() },
      });
      if (existingBySerial) {
        throw new BadRequestException(
          `Brojilo sa serijskim brojem "${createInstallationRecordDto.serialNumber}" već postoji.`,
        );
      }
      const branchId =
        createInstallationRecordDto.branchId ?? ctx?.branchId ?? undefined;
      if (branchId && ctx && ctx.role === UserRole.DIST_ADMIN) {
        const branch = await this.prisma.branch.findUnique({
          where: { id: branchId },
          select: { distributionId: true },
        });
        if (!branch || branch.distributionId !== ctx.distributionId) {
          throw new ForbiddenException('Podružnica ne pripada vašoj distribuciji.');
        }
      }

      const validatedDynamic = await this.meterTypeFieldsService.validateDynamicValues(
        createInstallationRecordDto.meterTypeDefinitionId,
        createInstallationRecordDto.dynamicFieldValues ?? null,
      );

      newMeterData = {
        serialNumber: createInstallationRecordDto.serialNumber.trim(),
        meterTypeDefinitionId: createInstallationRecordDto.meterTypeDefinitionId,
        branchId,
        year: createInstallationRecordDto.year ?? undefined,
        calibrationYear: createInstallationRecordDto.calibrationYear ?? undefined,
        installationAddress: createInstallationRecordDto.installationAddress ?? undefined,
        installationDate: createInstallationRecordDto.installationDate
          ? new Date(createInstallationRecordDto.installationDate)
          : undefined,
        city: createInstallationRecordDto.city ?? undefined,
        municipality: createInstallationRecordDto.municipality ?? undefined,
        measuringPoint: createInstallationRecordDto.measuringPoint ?? undefined,
        latitude: createInstallationRecordDto.latitude ?? undefined,
        longitude: createInstallationRecordDto.longitude ?? undefined,
        ...(Object.keys(validatedDynamic).length > 0 && {
          dynamicFieldValues: validatedDynamic as Prisma.InputJsonValue,
        }),
      };
    } else {
      throw new BadRequestException(
        'Navedite ili postojeće brojilo (meterId) ili tip brojila + serijski broj (meterTypeDefinitionId, serialNumber).',
      );
    }

    let record: InstallationRecord | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        record = await this.prisma.$transaction(async (tx) => {
          const claimedSim = await tx.simCard.updateMany({
            where: {
              id: simCardId,
              OR: [
                { status: SimCardStatus.AVAILABLE },
                { status: SimCardStatus.ASSIGNED, assignedToId: effectiveInstalledById },
              ],
            },
            data: { status: SimCardStatus.INSTALLED },
          });
          if (claimedSim.count === 0) {
            throw new BadRequestException('SIM kartica je u međuvremenu zauzeta.');
          }

          let resolvedMeterId = meterIdForLookup;
          if (!resolvedMeterId && newMeterData) {
            const createdMeter = await tx.meter.create({
              data: {
                ...newMeterData,
                simCardId,
                simCardState: MeterSimCardState.INSTALLED,
                noSimReason: null,
              },
            });
            resolvedMeterId = createdMeter.id;
          } else if (resolvedMeterId) {
            await tx.meter.update({
              where: { id: resolvedMeterId },
              data: {
                simCardId,
                simCardState: MeterSimCardState.INSTALLED,
                noSimReason: null,
              },
            });
          }

          if (!resolvedMeterId) {
            throw new BadRequestException('Brojilo nije pronađeno.');
          }

          if (existingMeterSimCardId && existingMeterSimCardId !== simCardId) {
            await tx.simCard.update({
              where: { id: existingMeterSimCardId },
              data: { status: SimCardStatus.DEMOUNTED },
            });
          }

          const recordNumber = await this.recordNumberGenerator.generate(tx);
          const createdRecord = await tx.installationRecord.create({
            data: {
              recordNumber,
              clientRequestId: createInstallationRecordDto.clientRequestId ?? undefined,
              kind,
              ...(demountedMeterSnapshot !== undefined
                ? { demountedMeterSnapshot }
                : {}),
              meterId: resolvedMeterId,
              simCardId,
              installedById: effectiveInstalledById,
              notes: createInstallationRecordDto.notes,
              photos: createInstallationRecordDto.photos
                ? (createInstallationRecordDto.photos as string[])
                : undefined,
            },
          });

          await tx.simEvent.create({
            data: {
              simCardId,
              type: 'INSTALLED',
              recordId: createdRecord.id,
              userId: effectiveInstalledById ?? ctx?.userId,
              branchId: ctx?.branchId ?? null,
              metadata: {
                recordNumber: createdRecord.recordNumber,
                type: 'INSTALLED',
              },
            },
          });

          if (existingMeterSimCardId && existingMeterSimCardId !== simCardId) {
            await tx.simEvent.create({
              data: {
                simCardId: existingMeterSimCardId,
                type: 'DEMOUNTED',
                userId: effectiveInstalledById ?? ctx?.userId,
                metadata: { replacedBySimCardId: simCardId },
              },
            });
          }

          return createdRecord;
        });
        break;
      } catch (err) {
        const isRecordNumberCollision =
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002' &&
          String(err.meta?.target ?? '').includes('record_number');
        if (!isRecordNumberCollision || attempt === 4) {
          throw err;
        }
      }
    }

    if (!record) {
      throw new BadRequestException('Kreiranje zapisnika nije uspjelo.');
    }

    await this.activityLogService.log({
      userId: effectiveInstalledById ?? ctx?.userId,
      action: 'CREATE',
      entity: 'installation_record',
      entityId: record.id,
      details: { recordNumber: record.recordNumber, status: record.status },
      ipAddress: ctx?.ipAddress,
    });
    this.autoSendRecordEmail(record.id, ctx).catch(() => {});
    return record;
  }

  async findAll(
    filter: InstallationRecordFilterDto,
    scope?: ScopeContext | null,
  ): Promise<PaginatedResult<InstallationRecord>> {
    return this.findManyWithFilter(filter, undefined, scope);
  }

  async findAllForUser(
    userId: string,
    filter: InstallationRecordFilterDto,
    scope?: ScopeContext | null,
  ): Promise<PaginatedResult<InstallationRecord>> {
    const moderatedBranches = await this.prisma.branchModerator.findMany({
      where: { userId },
      select: { branchId: true },
    });
    if (moderatedBranches.length > 0) {
      const branchIds = moderatedBranches.map((b) => b.branchId);
      return this.findManyWithFilter(
        filter,
        undefined,
        scope,
        { meter: { branchId: { in: branchIds } } },
      );
    }
    return this.findManyWithFilter(filter, { installedById: userId }, scope);
  }

  async findAllByInstaller(
    installedById: string,
    filter: InstallationRecordFilterDto,
    scope?: ScopeContext | null,
  ): Promise<PaginatedResult<InstallationRecord>> {
    return this.findManyWithFilter(filter, { installedById }, scope);
  }

  private async findManyWithFilter(
    filter: InstallationRecordFilterDto,
    extraWhere: { installedById?: string } | undefined,
    scope?: ScopeContext | null,
    additionalWhere?: Record<string, unknown>,
  ): Promise<PaginatedResult<InstallationRecord>> {
    if (
      scope?.role === 'USER' &&
      !scope.branchId &&
      !(scope.branchModeratorBranchIds?.length) &&
      !additionalWhere
    ) {
      throw new ForbiddenException(
        'Korisnik mora biti vezan za podružnicu da bi pristupio listi zapisnika.',
      );
    }
    const { page, limit, status, meterId } = filter;
    const skip = (page - 1) * limit;
    const scopeClause = additionalWhere ? undefined : scopeWhere(scope, { viaMeter: true });
    const andClauses: Record<string, unknown>[] = [];
    if (scopeClause) andClauses.push(scopeClause);
    if (additionalWhere) andClauses.push(additionalWhere);
    const where = {
      ...(status ? { status } : {}),
      ...(meterId ? { meterId } : {}),
      ...(extraWhere ?? {}),
      ...(andClauses.length ? { AND: andClauses } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.installationRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          meter: {
            include: {
              meterTypeDefinition: true,
              simCard: { include: { assignedTo: { select: SAFE_USER_SELECT } } },
            },
          },
          installedBy: { select: SAFE_USER_SELECT },
          approvedBy: { select: SAFE_USER_SELECT },
        },
      }),
      this.prisma.installationRecord.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findOne(id: string, scope?: ScopeContext | null): Promise<InstallationRecord> {
    if (
      scope?.role === 'USER' &&
      !scope.branchId &&
      !(scope.branchModeratorBranchIds?.length)
    ) {
      throw new ForbiddenException(
        'Korisnik mora biti vezan za podružnicu da bi pristupio zapisniku.',
      );
    }
    const scopeClause = scopeWhere(scope, { viaMeter: true });
    const installationRecord = await this.prisma.installationRecord.findFirst({
      where: {
        id,
        ...(scopeClause ? { AND: [scopeClause] } : {}),
      },
      include: {
        simCard: { include: { assignedTo: { select: SAFE_USER_SELECT } } },
        meter: {
          include: {
            meterTypeDefinition: true,
            simCard: { include: { assignedTo: { select: SAFE_USER_SELECT } } },
          },
        },
        installedBy: { select: SAFE_USER_SELECT },
        approvedBy: { select: SAFE_USER_SELECT },
      },
    });

    if (!installationRecord) {
      throw new NotFoundException(
        `InstallationRecord with ID ${id} not found`,
      );
    }

    return installationRecord;
  }

  async getTimeline(
    id: string,
    scope: ScopeContext | null,
    page: number,
    limit: number,
  ) {
    await this.findOne(id, scope);
    return this.activityLogService.findForEntity(
      'installation_record',
      id,
      page,
      limit,
    );
  }

  async getPermissions(
    id: string,
    userId: string,
    scope?: ScopeContext | null,
  ): Promise<{
    canRetrySend: boolean;
    canMarkSepActivated: boolean;
  }> {
    const record = await this.findOne(id, scope);
    const isAdmin = scope?.role === 'SYSTEM_ADMIN' || scope?.role === 'DIST_ADMIN';
    let isBranchModerator = false;
    if (scope?.role === 'USER') {
      const meter = await this.prisma.meter.findUnique({
        where: { id: record.meterId },
        select: { branchId: true },
      });
      if (meter?.branchId) {
        const modEntry = await this.prisma.branchModerator.findUnique({
          where: { userId_branchId: { userId, branchId: meter.branchId } },
        });
        isBranchModerator = !!modEntry;
      }
    }
    return {
      canRetrySend:
        record.status === RecordStatus.SEND_FAILED &&
        (record.installedById === userId || isAdmin),
      canMarkSepActivated:
        record.status === RecordStatus.SENT &&
        (isAdmin || isBranchModerator),
    };
  }

  async isBranchModerator(userId: string, branchId: string): Promise<boolean> {
    const entry = await this.prisma.branchModerator.findUnique({
      where: { userId_branchId: { userId, branchId } },
    });
    return !!entry;
  }

  async update(
    id: string,
    updateInstallationRecordDto: UpdateInstallationRecordDto,
    ctx?: InstallationRecordContext,
    scope?: ScopeContext | null,
  ): Promise<InstallationRecord> {
    await this.findOne(id, scope);
    try {
      const record = await this.prisma.installationRecord.update({
        where: { id },
        data: updateInstallationRecordDto,
      });
      await this.activityLogService.log({
        userId: ctx?.userId,
        action: 'UPDATE',
        entity: 'installation_record',
        entityId: id,
        details: { fields: Object.keys(updateInstallationRecordDto) },
        ipAddress: ctx?.ipAddress,
      });
      return record;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(
          `InstallationRecord with ID ${id} not found`,
        );
      }
      throw error;
    }
  }

  async remove(
    id: string,
    ctx?: InstallationRecordContext,
  ): Promise<InstallationRecord> {
    try {
      const record = await this.prisma.installationRecord.delete({
        where: { id },
      });
      await this.activityLogService.log({
        userId: ctx?.userId,
        action: 'DELETE',
        entity: 'installation_record',
        entityId: id,
        details: { recordNumber: record.recordNumber },
        ipAddress: ctx?.ipAddress,
      });
      return record;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(
          `InstallationRecord with ID ${id} not found`,
        );
      }
      throw error;
    }
  }

  async markSepActivated(
    id: string,
    ctx?: InstallationRecordContext,
    scope?: ScopeContext | null,
  ): Promise<InstallationRecord> {
    const record = await this.findOne(id, scope);
    if (record.status !== RecordStatus.SENT) {
      throw new BadRequestException(
        `Zapisnik se može označiti kao SEP aktiviran samo iz statusa SENT. Trenutni: ${record.status}`,
      );
    }
    if (scope?.role === 'USER' && ctx?.userId) {
      const meter = await this.prisma.meter.findUnique({
        where: { id: record.meterId },
        select: { branchId: true },
      });
      if (!meter?.branchId) {
        throw new ForbiddenException(
          'Zapisnik nema povezanu podružnicu.',
        );
      }
      const isMod = await this.isBranchModerator(ctx.userId, meter.branchId);
      if (!isMod) {
        throw new ForbiddenException(
          'Nemate pravo moderatora za ovu podružnicu.',
        );
      }
    }
    const updated = await this.prisma.installationRecord.update({
      where: { id },
      data: { status: RecordStatus.SEP_ACTIVATED },
    });
    await this.activityLogService.log({
      userId: ctx?.userId,
      action: 'MARK_SEP_ACTIVATED',
      entity: 'installation_record',
      entityId: id,
      details: { recordNumber: record.recordNumber },
      ipAddress: ctx?.ipAddress,
    });
    await this.createSimEventFromInstallationRecord(
      id,
      'SEP_ACTIVATED',
      ctx?.userId,
    );
    return updated;
  }

  async retrySendEmail(
    id: string,
    ctx?: InstallationRecordContext,
    scope?: ScopeContext | null,
  ): Promise<InstallationRecord> {
    const record = await this.findOne(id, scope);
    if (record.status !== RecordStatus.SEND_FAILED) {
      throw new BadRequestException(
        `Ponovo slanje je moguće samo iz statusa SEND_FAILED. Trenutni: ${record.status}`,
      );
    }
    return this.autoSendRecordEmail(id, ctx, scope);
  }

  private async serializeRecordForPdf(record: InstallationRecord & {
    kind?: InstallationRecordKind;
    demountedMeterSnapshot?: Prisma.JsonValue | null;
    photos?: string[] | null;
    createdAt?: Date;
    meter?: {
      serialNumber: string;
      year?: number | null;
      calibrationYear?: number | null;
      notes?: string | null;
      installationAddress?: string | null;
      installationDate?: Date | null;
      city?: string | null;
      municipality?: string | null;
      measuringPoint?: string | null;
      latitude?: number | string | null;
      longitude?: number | string | null;
      dynamicFieldValues?: Record<string, unknown> | null;
      meterTypeDefinitionId: string;
      meterTypeDefinition?: { name: string; manufacturer?: string | null; model?: string | null; type: string; maxCurrent?: string | null } | null;
      simCard?: { iccid: string; ipAddress: string; publicIpAddress?: string | null; phoneNumber?: string | null; apn?: string | null; assignedTo?: { firstName: string; lastName: string } | null } | null;
    } | null;
    simCard?: { iccid: string; ipAddress: string; publicIpAddress?: string | null; phoneNumber?: string | null; apn?: string | null; assignedTo?: { firstName: string; lastName: string } | null } | null;
    installedBy?: { firstName: string; lastName: string } | null;
    approvedBy?: { firstName: string; lastName: string } | null;
  }): Promise<Record<string, unknown>> {
    const formatDate = (d: Date | string | null | undefined) =>
      d ? new Date(d).toLocaleDateString('bs-BA', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
    const typeLabel = (t: string) => (t === 'SINGLE_PHASE' ? 'Jednofazno' : t === 'THREE_PHASE' ? 'Trofazno' : t);
    const simCard = record.simCard ?? record.meter?.simCard;
    const simCardPlain = simCard
      ? {
          iccid: simCard.iccid,
          ipAddress: simCard.ipAddress,
          publicIpAddress: simCard.publicIpAddress ?? '',
          phoneNumber: simCard.phoneNumber ?? '',
          assignedTo: simCard.assignedTo
            ? `${simCard.assignedTo.firstName} ${simCard.assignedTo.lastName}`
            : '',
        }
      : null;
    const typeDef = record.meter?.meterTypeDefinition;
    const meterPlain = record.meter
      ? {
          serialNumber: record.meter.serialNumber,
          year: record.meter.year ?? '',
          calibrationYear: record.meter.calibrationYear ?? '',
          notes: record.meter.notes ?? '',
          installationAddress: record.meter.installationAddress ?? '',
          installationDate: formatDate(record.meter.installationDate),
          city: record.meter.city ?? '',
          municipality: record.meter.municipality ?? '',
          measuringPoint: record.meter.measuringPoint ?? '',
          typeName: typeDef?.name ?? '',
          typeManufacturer: typeDef?.manufacturer ?? '',
          typeModel: typeDef?.model ?? '',
          typePhase: typeDef ? typeLabel(typeDef.type) : '',
          typeMaxCurrent: typeDef?.maxCurrent ?? '',
        }
      : null;
    const photos = (record.photos as string[] | undefined) ?? [];
    const uploadsRoot = this.uploadsRoot;
    const photoDataUrls: string[] = [];
    for (const p of photos) {
      if (typeof p !== 'string' || !p.startsWith('installation-records/')) continue;
      const fullPath = path.join(uploadsRoot, p);
      try {
        if (fs.existsSync(fullPath)) {
          const buf = fs.readFileSync(fullPath);
          const ext = path.extname(p).toLowerCase();
          const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
          photoDataUrls.push(`data:${mime};base64,${buf.toString('base64')}`);
        }
      } catch {
        // skip invalid photos
      }
    }
    const dynamicFields: { label: string; value: string }[] = [];
    if (record.meter?.dynamicFieldValues && record.meter.meterTypeDefinitionId) {
      const fieldDefs = await this.meterTypeFieldsService.findAllByDefinition(
        record.meter.meterTypeDefinitionId,
      );
      const vals = record.meter.dynamicFieldValues as Record<string, unknown>;
      for (const fd of fieldDefs) {
        const raw = vals[fd.name];
        if (raw === undefined || raw === null || raw === '') continue;
        let display = String(raw);
        if (fd.fieldType === 'BOOLEAN') {
          display = raw === true || raw === 'true' ? 'Da' : 'Ne';
        } else if (fd.fieldType === 'DATE') {
          display = formatDate(raw as string);
        }
        dynamicFields.push({ label: fd.label, value: display });
      }
    }

    const isMeterReplacement = record.kind === InstallationRecordKind.METER_REPLACEMENT;
    let demountedMeterPlain: Record<string, unknown> | null = null;
    const demountedDynamicFields: { label: string; value: string }[] = [];
    if (isMeterReplacement && record.demountedMeterSnapshot != null) {
      const snap = record.demountedMeterSnapshot as Record<string, unknown>;
      const demDefId =
        typeof snap.meterTypeDefinitionId === 'string' ? snap.meterTypeDefinitionId : '';
      const demTypeDef = demDefId
        ? await this.prisma.meterTypeDefinition.findUnique({ where: { id: demDefId } })
        : null;
      demountedMeterPlain = {
        serialNumber: typeof snap.serialNumber === 'string' ? snap.serialNumber : '',
        year: snap.year != null ? String(snap.year) : '',
        calibrationYear: snap.calibrationYear != null ? String(snap.calibrationYear) : '',
        notes: typeof snap.notes === 'string' ? snap.notes : '',
        typeName: demTypeDef?.name ?? '',
        typeManufacturer: demTypeDef?.manufacturer ?? '',
        typeModel: demTypeDef?.model ?? '',
        typePhase: demTypeDef ? typeLabel(demTypeDef.type) : '',
        typeMaxCurrent: demTypeDef?.maxCurrent ?? '',
        hadIntegratedSimText:
          snap.hadIntegratedSim === true ? 'Da' : snap.hadIntegratedSim === false ? 'Ne' : '–',
        noSimNote: typeof snap.noSimNote === 'string' ? snap.noSimNote : '',
      };
      const demDyn = snap.dynamicFieldValues as Record<string, unknown> | undefined;
      if (demDyn && demDefId) {
        const fieldDefs = await this.meterTypeFieldsService.findAllByDefinition(demDefId);
        for (const fd of fieldDefs) {
          const raw = demDyn[fd.name];
          if (raw === undefined || raw === null || raw === '') continue;
          let display = String(raw);
          if (fd.fieldType === 'BOOLEAN') {
            display = raw === true || raw === 'true' ? 'Da' : 'Ne';
          } else if (fd.fieldType === 'DATE') {
            display = formatDate(raw as string);
          }
          demountedDynamicFields.push({ label: fd.label, value: display });
        }
      }
    }

    return {
      recordNumber: record.recordNumber,
      installationAddress: (record.meter?.installationAddress ?? '') as string,
      installationDate: (record.meter ? formatDate(record.meter.installationDate) : '') as string,
      city: (record.meter?.city ?? '') as string,
      municipality: (record.meter?.municipality ?? '') as string,
      measuringPoint: (record.meter?.measuringPoint ?? '') as string,
      notes: record.notes ?? '',
      simCard: simCardPlain,
      meter: meterPlain,
      installedBy: record.installedBy
        ? { firstName: record.installedBy.firstName, lastName: record.installedBy.lastName }
        : null,
      approvedBy: record.approvedBy
        ? { firstName: record.approvedBy.firstName, lastName: record.approvedBy.lastName }
        : null,
      hasPhotos: photoDataUrls.length > 0,
      photoDataUrls,
      hasDynamicFields: dynamicFields.length > 0,
      dynamicFields,
      isMeterReplacement,
      demountedMeter: demountedMeterPlain,
      hasDemountedDynamicFields: demountedDynamicFields.length > 0,
      demountedDynamicFields,
    };
  }

  async generatePdf(id: string, scope?: ScopeContext | null): Promise<Buffer> {
    const installationRecord = await this.findOne(id, scope) as Parameters<InstallationRecordsService['serializeRecordForPdf']>[0];
    const pdfData = await this.serializeRecordForPdf(installationRecord);
    const templateName =
      installationRecord.kind === InstallationRecordKind.METER_REPLACEMENT
        ? 'installation-record-meter-replacement'
        : 'installation-record';
    const buffer = await this.pdfGenerator.generatePdf(templateName, pdfData);
    const { baseRelativeDir, baseAbsoluteDir } = this.getRecordBaseDir(installationRecord);
    const sanitizedFileName = `${this.sanitizePathSegment(installationRecord.recordNumber)}.pdf`;
    const relativePath = path.posix.join(baseRelativeDir, 'zapisnik', sanitizedFileName);
    const absoluteDir = path.join(baseAbsoluteDir, 'zapisnik');
    const absolutePath = path.join(absoluteDir, sanitizedFileName);
    let savedToDisk = false;
    try {
      fs.mkdirSync(absoluteDir, { recursive: true });
      fs.writeFileSync(absolutePath, buffer);
      savedToDisk = true;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code === 'EACCES' || code === 'EPERM' || code === 'EROFS') {
        const uid = process.getuid?.();
        const gid = process.getgid?.();
        this.logger.error(
          `Cannot persist generated PDF to "${absolutePath}" (${code}, uid=${uid}, gid=${gid}). ` +
            'Returning PDF buffer without caching to disk. Ensure the host uploads mount is writable by UID/GID 1000:1000 (chown -R 1000:1000 <host_uploads_dir>).',
        );
      } else {
        throw error;
      }
    }
    if (savedToDisk) {
      await this.prisma.installationRecord.update({
        where: { id },
        data: { pdfPath: relativePath },
      });
    }
    return buffer;
  }

  async autoSendRecordEmail(
    id: string,
    ctx?: InstallationRecordContext,
    scope?: ScopeContext | null,
  ): Promise<InstallationRecord> {
    const record = await this.findOne(id, scope) as Parameters<InstallationRecordsService['serializeRecordForPdf']>[0];
    const meter = await this.prisma.meter.findUnique({
      where: { id: record.meterId },
      select: { branchId: true },
    });
    const branchId = meter?.branchId ?? ctx?.branchId;
    let emails: string[] = [];
    if (branchId) {
      const recipients = await this.prisma.branchEmailRecipient.findMany({
        where: { branchId, isActive: true },
        select: { email: true },
      });
      emails = recipients.map((r) => r.email);
    }
    const uniqueEmails = [...new Set(emails)].filter((e) => e?.trim());

    let pdfBuffer: Buffer | null = null;
    if (record.pdfPath) {
      const absolutePath = this.resolveUploadsPath(record.pdfPath);
      if (fs.existsSync(absolutePath)) {
        try {
          pdfBuffer = fs.readFileSync(absolutePath);
        } catch (error) {
          this.logger.warn(
            `Cannot read cached PDF "${absolutePath}" (${(error as NodeJS.ErrnoException)?.code ?? 'unknown'}); regenerating.`,
          );
        }
      }
    }
    if (!pdfBuffer) {
      pdfBuffer = await this.generatePdf(id, scope);
    }

    if (uniqueEmails.length === 0) {
      const updated = await this.prisma.installationRecord.update({
        where: { id },
        data: { status: RecordStatus.SENT, sentAt: new Date() },
      });
      await this.activityLogService.log({
        userId: ctx?.userId,
        action: 'SEND',
        entity: 'installation_record',
        entityId: id,
        details: { recordNumber: record.recordNumber, warning: 'No email recipients configured for branch' },
        ipAddress: ctx?.ipAddress,
      });
      return updated;
    }

    const pdfFileName = `${record.recordNumber.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`;
    const subject =
      record.kind === InstallationRecordKind.METER_REPLACEMENT
        ? `Zapisnik o zamjeni brojila ${record.recordNumber} - SIM Tracker`
        : `Zapisnik o ugradnji ${record.recordNumber} - SIM Tracker`;

    try {
      await this.mailService.sendRecordWithPdf({
        to: uniqueEmails,
        subject,
        recordNumber: record.recordNumber,
        recordId: id,
        pdfBuffer,
        pdfFileName,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Slanje email-a nije uspjelo';
      await this.prisma.installationRecord.update({
        where: { id },
        data: { status: RecordStatus.SEND_FAILED },
      });
      await this.activityLogService.log({
        userId: ctx?.userId,
        action: 'SEND_FAILED',
        entity: 'installation_record',
        entityId: id,
        details: { recordNumber: record.recordNumber, error: msg },
        ipAddress: ctx?.ipAddress,
      });
      return this.findOne(id, scope);
    }

    const updated = await this.prisma.installationRecord.update({
      where: { id },
      data: {
        status: RecordStatus.SENT,
        sentAt: new Date(),
        sentToEmail: uniqueEmails.join(', '),
      },
    });

    await this.activityLogService.log({
      userId: ctx?.userId,
      action: 'SEND',
      entity: 'installation_record',
      entityId: id,
      details: { recordNumber: record.recordNumber, sentTo: uniqueEmails },
      ipAddress: ctx?.ipAddress,
    });

    await this.createSimEventFromInstallationRecord(id, 'SENT', ctx?.userId);

    return updated;
  }

  
  private async createSimEventFromInstallationRecord(
    recordId: string,
    type: string,
    userId?: string,
    ctx?: InstallationRecordContext,
  ) {
    const record = await this.prisma.installationRecord.findUnique({
      where: { id: recordId },
      select: {
        id: true,
        recordNumber: true,
        simCardId: true,
        meter: {
          select: {
            simCardId: true,
          },
        },
      },
    });
    if (!record) {
      return;
    }
    const simCardId = record?.simCardId ?? record?.meter?.simCardId ?? null;
    if (!simCardId) {
      return;
    }
    await this.prisma.simEvent.create({
      data: {
        simCardId,
        type,
        recordId: record.id,
        userId,
        branchId: ctx?.branchId ?? null,
        metadata: {
          recordNumber: record.recordNumber,
          type,
        },
      },
    });
  }
}
