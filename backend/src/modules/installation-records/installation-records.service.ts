import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { scopeWhere, ScopeContext } from 'src/common/utils/scope-filter.util';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateInstallationRecordDto } from './dto/create-installation-record.dto';
import { UpdateInstallationRecordDto } from './dto/update-installation-record.dto';
import { Prisma, InstallationRecord, RecordStatus, SimCardStatus } from '@prisma/client';
import { InstallationRecordFilterDto } from './dto/installation-record-filter.dto';
import { PaginatedResult } from 'src/common/interfaces/paginated-result.interface';
import { RecordNumberGenerator } from 'src/common/utils/record-number.generator';
import { PdfGeneratorService } from 'src/common/utils/pdf-generator.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { MailService } from '../mail/mail.service';
import { MeterTypeFieldsService } from '../meter-type-definitions/meter-type-fields.service';
import * as fs from 'fs';
import * as path from 'path';

export type InstallationRecordContext = {
  userId?: string;
  ipAddress?: string;
  /** branchId trenutnog korisnika – za operatora se postavlja na meter pri kreiranju novog brojila */
  branchId?: string | null;
};

@Injectable()
export class InstallationRecordsService {
  private readonly pdfStorageDir = path.join(
    process.cwd(),
    'generated',
    'pdf',
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly recordNumberGenerator: RecordNumberGenerator,
    private readonly pdfGenerator: PdfGeneratorService,
    private readonly activityLogService: ActivityLogService,
    private readonly mailService: MailService,
    private readonly meterTypeFieldsService: MeterTypeFieldsService,
  ) {}

  async create(
    createInstallationRecordDto: CreateInstallationRecordDto,
    ctx?: InstallationRecordContext,
  ): Promise<InstallationRecord> {
    let meterId: string;

    if (createInstallationRecordDto.meterId) {
      const meter = await this.prisma.meter.findUnique({
        where: { id: createInstallationRecordDto.meterId },
      });
      if (!meter) {
        throw new BadRequestException('Brojilo nije pronađeno.');
      }
      meterId = meter.id;
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
      const existing = await this.prisma.meter.findUnique({
        where: { serialNumber: createInstallationRecordDto.serialNumber.trim() },
      });
      if (existing) {
        throw new BadRequestException(
          `Brojilo sa serijskim brojem "${createInstallationRecordDto.serialNumber}" već postoji.`,
        );
      }
      const branchId =
        createInstallationRecordDto.branchId ?? ctx?.branchId ?? undefined;

      const validatedDynamic = await this.meterTypeFieldsService.validateDynamicValues(
        createInstallationRecordDto.meterTypeDefinitionId,
        createInstallationRecordDto.dynamicFieldValues ?? null,
      );

      const meter = await this.prisma.meter.create({
        data: {
          serialNumber: createInstallationRecordDto.serialNumber.trim(),
          meterTypeDefinitionId: createInstallationRecordDto.meterTypeDefinitionId,
          branchId,
          year: createInstallationRecordDto.year ?? undefined,
          installationAddress: createInstallationRecordDto.installationAddress ?? undefined,
          installationDate: createInstallationRecordDto.installationDate
            ? new Date(createInstallationRecordDto.installationDate)
            : undefined,
          city: createInstallationRecordDto.city ?? undefined,
          municipality: createInstallationRecordDto.municipality ?? undefined,
          measuringPoint: createInstallationRecordDto.measuringPoint ?? undefined,
          latitude: createInstallationRecordDto.latitude ?? undefined,
          longitude: createInstallationRecordDto.longitude ?? undefined,
          ...(Object.keys(validatedDynamic).length > 0 && { dynamicFieldValues: validatedDynamic as Prisma.InputJsonValue }),
        },
      });
      meterId = meter.id;
    } else {
      throw new BadRequestException(
        'Navedite ili postojeće brojilo (meterId) ili tip brojila + serijski broj (meterTypeDefinitionId, serialNumber).',
      );
    }

    const simCardId = createInstallationRecordDto.simCardId;
    const simCard = await this.prisma.simCard.findUnique({
      where: { id: simCardId },
    });
    if (!simCard) {
      throw new BadRequestException('SIM kartica nije pronađena.');
    }

    const meter = await this.prisma.meter.findUnique({
      where: { id: meterId },
      select: { simCardId: true },
    });
    await this.prisma.$transaction(async (tx) => {
      await tx.meter.update({
        where: { id: meterId },
        data: { simCardId },
      });
      await tx.simCard.update({
        where: { id: simCardId },
        data: { status: SimCardStatus.INSTALLED },
      });
      if (meter?.simCardId && meter.simCardId !== simCardId) {
        await tx.simCard.update({
          where: { id: meter.simCardId },
          data: { status: SimCardStatus.DEMOUNTED },
        });
      }
    });

    const recordNumber = await this.recordNumberGenerator.generate();
    const record = await this.prisma.installationRecord.create({
      data: {
        recordNumber,
        meterId,
        installedById: createInstallationRecordDto.installedById,
        notes: createInstallationRecordDto.notes,
        photos: createInstallationRecordDto.photos
          ? (createInstallationRecordDto.photos as string[])
          : undefined,
      },
    });
    await this.activityLogService.log({
      userId: createInstallationRecordDto.installedById ?? ctx?.userId,
      action: 'CREATE',
      entity: 'installation_record',
      entityId: record.id,
      details: { recordNumber: record.recordNumber, status: record.status },
      ipAddress: ctx?.ipAddress,
    });
    await this.createSimEventFromInstallationRecord(
      record.id,
      'INSTALLED',
      createInstallationRecordDto.installedById ?? ctx?.userId,
      ctx,
    );
    if (meter?.simCardId && meter.simCardId !== simCardId) {
      await this.prisma.simEvent.create({
        data: {
          simCardId: meter.simCardId,
          type: 'DEMOUNTED',
          userId: createInstallationRecordDto.installedById ?? ctx?.userId,
          metadata: { replacedBySimCardId: simCardId },
        },
      });
    }
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
    if (scope?.role === 'USER' && !scope.branchId && !additionalWhere) {
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
              simCard: { include: { assignedTo: true } },
            },
          },
          installedBy: true,
          approvedBy: true,
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
    if (scope?.role === 'USER' && !scope.branchId) {
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
        meter: {
          include: {
            meterTypeDefinition: true,
            simCard: { include: { assignedTo: true } },
          },
        },
        installedBy: true,
        approvedBy: true,
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
  ): Promise<InstallationRecord> {
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
    photos?: string[] | null;
    meter?: {
      serialNumber: string;
      year?: number | null;
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
    installedBy?: { firstName: string; lastName: string } | null;
    approvedBy?: { firstName: string; lastName: string } | null;
  }): Promise<Record<string, unknown>> {
    const formatDate = (d: Date | string | null | undefined) =>
      d ? new Date(d).toLocaleDateString('bs-BA', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
    const typeLabel = (t: string) => (t === 'SINGLE_PHASE' ? 'Jednofazno' : t === 'THREE_PHASE' ? 'Trofazno' : t);
    const simCard = record.meter?.simCard;
    const simCardPlain = simCard
      ? {
          iccid: simCard.iccid,
          ipAddress: simCard.ipAddress,
          publicIpAddress: simCard.publicIpAddress ?? '',
          phoneNumber: simCard.phoneNumber ?? '',
          apn: simCard.apn ?? '',
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
          notes: record.meter.notes ?? '',
          installationAddress: record.meter.installationAddress ?? '',
          installationDate: formatDate(record.meter.installationDate),
          city: record.meter.city ?? '',
          municipality: record.meter.municipality ?? '',
          measuringPoint: record.meter.measuringPoint ?? '',
          latitude: record.meter.latitude != null ? String(record.meter.latitude) : undefined,
          longitude: record.meter.longitude != null ? String(record.meter.longitude) : undefined,
          typeName: typeDef?.name ?? '',
          typeManufacturer: typeDef?.manufacturer ?? '',
          typeModel: typeDef?.model ?? '',
          typePhase: typeDef ? typeLabel(typeDef.type) : '',
          typeMaxCurrent: typeDef?.maxCurrent ?? '',
        }
      : null;
    const photos = (record.photos as string[] | undefined) ?? [];
    const uploadsRoot =
      (this as any).config?.get?.('UPLOAD_ROOT_PATH') ?? path.join(process.cwd(), 'uploads');
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
    };
  }

  async generatePdf(id: string, scope?: ScopeContext | null): Promise<Buffer> {
    const installationRecord = await this.findOne(id, scope) as Parameters<InstallationRecordsService['serializeRecordForPdf']>[0];
    const pdfData = await this.serializeRecordForPdf(installationRecord);
    const buffer = await this.pdfGenerator.generatePdf(
      'installation-record',
      pdfData,
    );
    const sanitizedFileName = `${installationRecord.recordNumber.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`;
    const relativePath = path.join('generated', 'pdf', sanitizedFileName);
    const absolutePath = path.join(this.pdfStorageDir, sanitizedFileName);
    fs.mkdirSync(this.pdfStorageDir, { recursive: true });
    fs.writeFileSync(absolutePath, buffer);
    await this.prisma.installationRecord.update({
      where: { id },
      data: { pdfPath: relativePath },
    });
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

    let pdfBuffer: Buffer;
    if (record.pdfPath) {
      const absolutePath = path.join(process.cwd(), record.pdfPath);
      if (fs.existsSync(absolutePath)) {
        pdfBuffer = fs.readFileSync(absolutePath);
      } else {
        pdfBuffer = await this.generatePdf(id, scope);
      }
    } else {
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
    const subject = `Zapisnik o ugradnji ${record.recordNumber} - SIM Tracker`;

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
        meter: {
          select: {
            simCardId: true,
          },
        },
      },
    });
    if (!record?.meter?.simCardId) {
      return;
    }
    await this.prisma.simEvent.create({
      data: {
        simCardId: record.meter.simCardId,
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
