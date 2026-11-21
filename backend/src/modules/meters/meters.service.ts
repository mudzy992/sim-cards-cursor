import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Meter, MeterSimCardState, Prisma, UserRole } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { ErrorCodes } from 'src/common/constants/error-codes';
import { PaginatedResult } from 'src/common/interfaces/paginated-result.interface';
import { UploadsStorageService } from 'src/common/storage/uploads-storage.service';
import {
  assertMeterYearsPairIfPartial,
  assertMeterYearsRequired,
} from 'src/common/utils/meter-years.util';
import { SAFE_USER_SELECT } from 'src/common/utils/safe-user-select';
import { ScopeContext, scopeWhere } from 'src/common/utils/scope-filter.util';
import { PrismaService } from 'src/prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { AuthService } from '../auth/auth.service';
import { MeterTypeFieldsService } from '../meter-type-definitions/meter-type-fields.service';
import { CreateMeterDto } from './dto/create-meter.dto';
import {
  DeleteMeterDto,
  MeterDeleteRecordsAction,
  MeterDeleteSimAction,
} from './dto/delete-meter.dto';
import { MeterFilterDto } from './dto/meter-filter.dto';
import { UpdateMeterDto } from './dto/update-meter.dto';

type MeterDeleteSummary = {
  meter: {
    id: string;
    serialNumber: string;
    branchId: string | null;
    meterTypeDefinitionId: string;
    hasOpenInstallTask: boolean;
    hasOpenDemountTask: boolean;
    simCardId: string | null;
  };
  simCard: null | {
    id: string;
    iccid: string;
    status: string;
    assignedToId: string | null;
  };
  installationRecords: {
    count: number;
    items: Array<{
      id: string;
      recordNumber: string;
      status: string;
      createdAt: Date;
      pdfPath: string | null;
      photos: string[];
    }>;
  };
  tasks: {
    installTasksCount: number;
    demountTasksCount: number;
  };
};

type DeleteContext = { userId: string; ipAddress?: string };

@Injectable()
export class MetersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly meterTypeFieldsService: MeterTypeFieldsService,
    private readonly authService: AuthService,
    private readonly config: ConfigService,
    @Optional() private readonly activityLogService?: ActivityLogService,
    @Optional() private readonly uploadsStorage?: UploadsStorageService,
  ) {}

  private uploadsRoot(): string {
    return this.config.get<string>('UPLOAD_ROOT_PATH', path.join(process.cwd(), 'uploads'));
  }

  private removeRelativeDir(relativeDir: string): void {
    if (this.uploadsStorage) {
      this.uploadsStorage.removeDirRecursive(relativeDir);
      return;
    }
    const uploadsRoot = path.resolve(this.uploadsRoot());
    const resolved = path.resolve(uploadsRoot, relativeDir);
    if (!resolved.startsWith(`${uploadsRoot}${path.sep}`)) {
      return;
    }
    if (!fs.existsSync(resolved)) return;
    fs.rmSync(resolved, { recursive: true, force: true });
  }

  async create(
    createMeterDto: CreateMeterDto,
    scope?: ScopeContext | null,
    actorId?: string,
    ipAddress?: string,
  ): Promise<Meter> {
    assertMeterYearsRequired(createMeterDto.year, createMeterDto.calibrationYear, 'brojilo');

    const serialNumber = createMeterDto.serialNumber.trim();
    if (!serialNumber) {
      throw new BadRequestException('Serijski broj brojila je obavezan.');
    }

    await this.assertBranchScope(createMeterDto.branchId, scope);
    await this.assertMeterTypeExists(createMeterDto.meterTypeDefinitionId);

    const existingSerial = await this.prisma.meter.findUnique({
      where: { serialNumber },
      select: { id: true },
    });
    if (existingSerial) {
      throw new ConflictException(`Brojilo sa serijskim brojem "${serialNumber}" već postoji.`);
    }

    const data: Record<string, unknown> = {
      serialNumber,
      meterTypeDefinitionId: createMeterDto.meterTypeDefinitionId,
    };
    if (createMeterDto.branchId) data.branchId = createMeterDto.branchId;
    if (createMeterDto.status) data.status = createMeterDto.status;
    if (createMeterDto.year != null) data.year = createMeterDto.year;
    if (createMeterDto.calibrationYear != null) data.calibrationYear = createMeterDto.calibrationYear;
    if (createMeterDto.notes != null) data.notes = createMeterDto.notes;
    if (createMeterDto.installationAddress != null) {
      data.installationAddress = createMeterDto.installationAddress;
    }
    if (createMeterDto.installationDate) {
      data.installationDate = new Date(createMeterDto.installationDate);
    }
    if (createMeterDto.city != null) data.city = createMeterDto.city;
    if (createMeterDto.municipality != null) data.municipality = createMeterDto.municipality;
    if (createMeterDto.measuringPoint != null) data.measuringPoint = createMeterDto.measuringPoint;
    if (createMeterDto.latitude != null) data.latitude = createMeterDto.latitude;
    if (createMeterDto.longitude != null) data.longitude = createMeterDto.longitude;

    const validated = await this.meterTypeFieldsService.validateDynamicValues(
      createMeterDto.meterTypeDefinitionId,
      createMeterDto.dynamicFieldValues ?? null,
    );
    if (Object.keys(validated).length > 0) {
      data.dynamicFieldValues = validated;
    }

    if (createMeterDto.simCardState) {
      if (createMeterDto.simCardState === MeterSimCardState.INSTALLED) {
        throw new BadRequestException({
          message: 'simCardState=INSTALLED nije dozvoljen bez procesa ugradnje SIM-a.',
          code: ErrorCodes.METER_INSTALLED_WITHOUT_PROCESS,
        });
      }
      data.simCardState = createMeterDto.simCardState;
      data.noSimReason =
        createMeterDto.simCardState === MeterSimCardState.NO_SIM
          ? (createMeterDto.noSimReason ?? null)
          : null;
    } else if (createMeterDto.noSimReason) {
      data.simCardState = MeterSimCardState.NO_SIM;
      data.noSimReason = createMeterDto.noSimReason;
    }

    try {
      const created = await this.prisma.meter.create({
        data: data as Prisma.MeterUncheckedCreateInput,
      });

      if (this.activityLogService) {
        await this.activityLogService.log({
          userId: actorId,
          action: 'CREATE',
          entity: 'meter',
          entityId: created.id,
          details: {
            serialNumber: created.serialNumber,
            meterTypeDefinitionId: created.meterTypeDefinitionId,
            branchId: created.branchId,
          },
          ipAddress,
        });
      }

      return created;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(`Brojilo sa serijskim brojem "${serialNumber}" već postoji.`);
      }
      throw error;
    }
  }

  async rollbackUnlinkedMeter(id: string): Promise<void> {
    await this.prisma.meter.deleteMany({
      where: {
        id,
        simCardId: null,
      },
    });
  }

  async findAll(
    filter: MeterFilterDto,
    scope?: ScopeContext | null,
  ): Promise<PaginatedResult<Meter & { meterTypeDefinition?: unknown }>> {
    const { page, limit, meterTypeDefinitionId, serialNumber, simCardState, status, branchId } =
      filter;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {};
    if (meterTypeDefinitionId) where.meterTypeDefinitionId = meterTypeDefinitionId;
    if (serialNumber?.trim()) {
      where.serialNumber = { contains: serialNumber.trim(), mode: 'insensitive' };
    }
    if (simCardState) where.simCardState = simCardState;
    if (status) where.status = status;
    if (branchId) where.branchId = branchId;

    const scopeClause = this.getMetersReadScopeClause(scope);
    if (scopeClause) {
      where.AND = where.AND
        ? [...(Array.isArray(where.AND) ? where.AND : [where.AND]), scopeClause]
        : [scopeClause];
    }
    const whereClause = Object.keys(where).length ? where : undefined;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.meter.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          meterTypeDefinition: true,
          branch: { select: { id: true, name: true, code: true } },
          simCard: true,
          demountTasks: {
            where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              assignedTo: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
      }),
      this.prisma.meter.count({ where: whereClause }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findOne(id: string, scope?: ScopeContext | null) {
    const scopeClause = this.getMetersReadScopeClause(scope);
    const meter = await this.prisma.meter.findFirst({
      where: {
        id,
        ...(scopeClause ? { AND: [scopeClause] } : {}),
      },
      include: {
        meterTypeDefinition: true,
        branch: { select: { id: true, name: true, code: true } },
        simCard: { include: { assignedTo: { select: SAFE_USER_SELECT } } },
        installTasks: {
          where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            assignedTo: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        demountTasks: {
          where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            assignedTo: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!meter) {
      throw new NotFoundException(`Meter with ID ${id} not found`);
    }

    return meter;
  }

  async update(
    id: string,
    updateMeterDto: UpdateMeterDto & {
      simCardId?: string | null;
      simCardState?: MeterSimCardState;
    },
    scope?: ScopeContext | null,
    actorId?: string,
    ipAddress?: string,
  ): Promise<Meter> {
    if (updateMeterDto.simCardId !== undefined || updateMeterDto.simCardState !== undefined) {
      throw new BadRequestException(
        'SIM kartica na brojilu se mijenja isključivo kroz zapisnik ugradnje ili nalog demontaže.',
      );
    }

    const scopeClause = scopeWhere(scope, { branchIdField: 'branchId' });
    const existing = await this.prisma.meter.findFirst({
      where: {
        id,
        ...(scopeClause ? { AND: [scopeClause] } : {}),
      },
      select: {
        id: true,
        serialNumber: true,
        year: true,
        calibrationYear: true,
        meterTypeDefinitionId: true,
      },
    });
    if (!existing) {
      throw new NotFoundException(`Meter with ID ${id} not found`);
    }

    if (updateMeterDto.branchId) {
      await this.assertBranchScope(updateMeterDto.branchId, scope);
    }
    if (
      updateMeterDto.meterTypeDefinitionId &&
      updateMeterDto.meterTypeDefinitionId !== existing.meterTypeDefinitionId
    ) {
      await this.assertMeterTypeExists(updateMeterDto.meterTypeDefinitionId);
    }

    const mergedYear =
      updateMeterDto.year !== undefined ? updateMeterDto.year : (existing.year ?? undefined);
    const mergedCalibration =
      updateMeterDto.calibrationYear !== undefined
        ? updateMeterDto.calibrationYear
        : (existing.calibrationYear ?? undefined);
    assertMeterYearsPairIfPartial(mergedYear, mergedCalibration);

    const data: Record<string, unknown> = { ...updateMeterDto };
    delete data.simCardId;
    delete data.simCardState;

    if (updateMeterDto.serialNumber !== undefined) {
      const trimmedSerial = updateMeterDto.serialNumber.trim();
      if (!trimmedSerial) {
        throw new BadRequestException('Serijski broj brojila ne smije biti prazan.');
      }
      if (trimmedSerial !== existing.serialNumber) {
        const dup = await this.prisma.meter.findUnique({
          where: { serialNumber: trimmedSerial },
          select: { id: true },
        });
        if (dup && dup.id !== id) {
          throw new ConflictException(`Brojilo sa serijskim brojem "${trimmedSerial}" već postoji.`);
        }
      }
      data.serialNumber = trimmedSerial;
    }

    if (data.installationDate && typeof data.installationDate === 'string') {
      data.installationDate = new Date(data.installationDate as string);
    }

    if (updateMeterDto.dynamicFieldValues !== undefined) {
      const targetTypeId =
        updateMeterDto.meterTypeDefinitionId ?? existing.meterTypeDefinitionId;
      const validated = await this.meterTypeFieldsService.validateDynamicValues(
        targetTypeId,
        updateMeterDto.dynamicFieldValues ?? null,
      );
      data.dynamicFieldValues = Object.keys(validated).length > 0 ? validated : Prisma.DbNull;
    }

    try {
      const updated = await this.prisma.meter.update({
        where: { id },
        data: data as Prisma.MeterUncheckedUpdateInput,
      });

      if (this.activityLogService) {
        await this.activityLogService.log({
          userId: actorId,
          action: 'UPDATE',
          entity: 'meter',
          entityId: id,
          details: { fields: Object.keys(updateMeterDto) },
          ipAddress,
        });
      }

      return updated;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException(`Meter with ID ${id} not found`);
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Brojilo sa ovim serijskim brojem već postoji.');
      }
      throw error;
    }
  }

  async remove(_id: string, _scope?: ScopeContext | null): Promise<Meter> {
    throw new BadRequestException(
      'Brisanje brojila nije dozvoljeno. Ispravke se rade kroz izmjene uz logovanje i proceduru demontaže.',
    );
  }

  async getDeleteSummary(id: string): Promise<MeterDeleteSummary> {
    const meter = await this.prisma.meter.findUnique({
      where: { id },
      select: {
        id: true,
        serialNumber: true,
        branchId: true,
        meterTypeDefinitionId: true,
        hasOpenInstallTask: true,
        hasOpenDemountTask: true,
        simCardId: true,
        simCard: {
          select: { id: true, iccid: true, status: true, assignedToId: true },
        },
      },
    });
    if (!meter) {
      throw new NotFoundException(`Meter with ID ${id} not found`);
    }

    const [installTasksCount, demountTasksCount, records] = await this.prisma.$transaction([
      this.prisma.installTask.count({ where: { meterId: id } }),
      this.prisma.demountTask.count({ where: { meterId: id } }),
      this.prisma.installationRecord.findMany({
        where: { meterId: id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          recordNumber: true,
          status: true,
          createdAt: true,
          pdfPath: true,
          photos: true,
        },
      }),
    ]);

    return {
      meter: {
        id: meter.id,
        serialNumber: meter.serialNumber,
        branchId: meter.branchId ?? null,
        meterTypeDefinitionId: meter.meterTypeDefinitionId,
        hasOpenInstallTask: meter.hasOpenInstallTask,
        hasOpenDemountTask: meter.hasOpenDemountTask,
        simCardId: meter.simCardId ?? null,
      },
      simCard: meter.simCard
        ? {
            id: meter.simCard.id,
            iccid: meter.simCard.iccid,
            status: meter.simCard.status,
            assignedToId: meter.simCard.assignedToId ?? null,
          }
        : null,
      installationRecords: {
        count: records.length,
        items: records.map((r) => ({
          id: r.id,
          recordNumber: r.recordNumber,
          status: r.status,
          createdAt: r.createdAt,
          pdfPath: r.pdfPath ?? null,
          photos: Array.isArray(r.photos)
            ? (r.photos as unknown as string[])
            : ((r.photos ?? []) as unknown as string[]),
        })),
      },
      tasks: { installTasksCount, demountTasksCount },
    };
  }

  async deleteWithConfirm(id: string, dto: DeleteMeterDto, ctx: DeleteContext) {
    await this.authService.verifyPassword(ctx.userId, dto.password);

    const meter = await this.prisma.meter.findUnique({
      where: { id },
      select: { id: true, serialNumber: true, simCardId: true },
    });
    if (!meter) {
      throw new NotFoundException({
        message: `Meter with ID ${id} not found`,
        code: ErrorCodes.METER_NOT_FOUND,
      });
    }

    const records = await this.prisma.installationRecord.findMany({
      where: { meterId: id },
      select: { id: true, createdAt: true, pdfPath: true, photos: true },
      orderBy: { createdAt: 'desc' },
    });

    if (records.length > 0 && dto.recordsAction === MeterDeleteRecordsAction.ABORT_IF_EXISTS) {
      throw new BadRequestException({
        message: 'Brojilo ima zapisnike. Preuzmite zapisnike pa odaberite brisanje zapisnika.',
        code: ErrorCodes.METER_HAS_RECORDS_CANNOT_DELETE,
      });
    }

    const baseDirsToCleanup = new Set<string>();
    const collectBaseDir = (p: string) => {
      const parts = p.split(/[\\/]+/).filter(Boolean);
      if (parts.length < 3 || parts[0] !== 'installation-records') return;
      baseDirsToCleanup.add(`${parts[0]}/${parts[1]}/${parts[2]}`);
    };
    for (const r of records) {
      if (r.pdfPath && typeof r.pdfPath === 'string') collectBaseDir(r.pdfPath);
      if (Array.isArray(r.photos)) {
        for (const p of r.photos) {
          if (typeof p === 'string') collectBaseDir(p);
        }
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      if (meter.simCardId) {
        if (dto.simAction === MeterDeleteSimAction.RETURN_SIM_TO_AVAILABLE) {
          await tx.meter.update({
            where: { id },
            data: {
              simCardId: null,
              simCardState: MeterSimCardState.NO_SIM,
              noSimReason: 'Obrisano brojilo (admin cleanup)',
            },
          });
          await tx.simCard.update({
            where: { id: meter.simCardId },
            data: {
              status: 'AVAILABLE',
              assignedToId: null,
              assignedAt: null,
            },
          });
        } else if (dto.simAction === MeterDeleteSimAction.DELETE_SIM) {
          await tx.meter.update({
            where: { id },
            data: {
              simCardId: null,
              simCardState: MeterSimCardState.NO_SIM,
              noSimReason: 'Obrisano brojilo (admin cleanup)',
            },
          });
          await tx.simCard.delete({ where: { id: meter.simCardId } });
        }
      }

      let deletedRecordsCount = 0;
      if (dto.recordsAction === MeterDeleteRecordsAction.DELETE_ALL) {
        const del = await tx.installationRecord.deleteMany({ where: { meterId: id } });
        deletedRecordsCount = del.count;
      }

      await tx.meter.delete({ where: { id } });

      await tx.activityLog.create({
        data: {
          userId: ctx.userId,
          action: 'DELETE',
          entity: 'meter',
          entityId: id,
          details: {
            serialNumber: meter.serialNumber,
            simAction: dto.simAction,
            recordsAction: dto.recordsAction,
            deletedRecordsCount,
          },
          ipAddress: ctx.ipAddress,
        },
      });

      return { deleted: true, deletedRecordsCount };
    });

    if (dto.recordsAction === MeterDeleteRecordsAction.DELETE_ALL) {
      for (const relDir of baseDirsToCleanup) {
        this.removeRelativeDir(relDir);
      }
    }

    return result;
  }

  /** Sva brojila – pri kreiranju zapisnika bira se brojilo i SIM (zapisnik = pridruživanje SIM brojilu). */
  async findAvailable(
    scope?: ScopeContext | null,
    opts?: { search?: string; limit?: number },
  ) {
    const scopeClause = this.getMetersReadScopeClause(scope);
    const search = opts?.search?.trim();
    const safeLimit = Math.min(Math.max(opts?.limit ?? 200, 1), 500);

    return this.prisma.meter.findMany({
      where: {
        ...(scopeClause ? { AND: [scopeClause] } : {}),
        ...(search
          ? {
              serialNumber: { contains: search, mode: 'insensitive' },
            }
          : {}),
      },
      orderBy: [{ meterTypeDefinition: { name: 'asc' } }, { serialNumber: 'asc' }],
      take: safeLimit,
      include: { meterTypeDefinition: true },
    });
  }

  private async assertBranchScope(
    branchId: string | undefined,
    scope?: ScopeContext | null,
  ): Promise<void> {
    if (!branchId) return;
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, distributionId: true },
    });
    if (!branch) {
      throw new BadRequestException({
        message: 'Odabrana podružnica ne postoji.',
        code: ErrorCodes.METER_BRANCH_NOT_FOUND,
      });
    }
    if (scope && scope.role === UserRole.DIST_ADMIN) {
      const distId = scope.distributionId;
      if (!distId || branch.distributionId !== distId) {
        throw new ForbiddenException({
          message: 'Podružnica ne pripada vašoj distribuciji.',
          code: ErrorCodes.METER_BRANCH_OUTSIDE_DISTRIBUTION,
        });
      }
    }
  }

  private async assertMeterTypeExists(meterTypeDefinitionId: string): Promise<void> {
    const def = await this.prisma.meterTypeDefinition.findUnique({
      where: { id: meterTypeDefinitionId },
      select: { id: true },
    });
    if (!def) {
      throw new NotFoundException('Odabrani tip brojila nije pronađen.');
    }
  }

  private getMetersReadScopeClause(scope?: ScopeContext | null) {
    if (
      scope &&
      scope.role === UserRole.USER &&
      (scope.branchModeratorBranchIds?.length ?? 0) > 0
    ) {
      const branchIds = Array.from(
        new Set(
          [scope.branchId, ...(scope.branchModeratorBranchIds ?? [])].filter(
            (id): id is string => Boolean(id),
          ),
        ),
      );
      if (branchIds.length > 0) {
        return { branchId: { in: branchIds } };
      }
    }
    return scopeWhere(scope, { branchIdField: 'branchId' });
  }
}
