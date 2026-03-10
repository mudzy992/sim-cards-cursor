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
import { RejectionReasonDto } from './dto/rejection-reason.dto';
import { PdfGeneratorService } from 'src/common/utils/pdf-generator.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { MailService } from '../mail/mail.service';
import { RecipientsService } from '../recipients/recipients.service';
import { NotificationsService } from '../notifications/notifications.service';
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
    private readonly recipientsService: RecipientsService,
    private readonly notificationsService: NotificationsService,
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
    const isApprover = await this.isUserApprovalOperator(userId, scope);
    if (isApprover) {
      // Approval operator should work on distribution scope (same visibility as moderator for records).
      if (scope?.distributionId) {
        return this.findManyWithFilter(filter, undefined, {
          role: 'MODERATOR',
          distributionId: scope.distributionId,
          branchId: null,
        });
      }
      return this.findManyWithFilter(filter, undefined, scope);
    }
    // Classic field operator (not in approval groups): only own records.
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
  ): Promise<PaginatedResult<InstallationRecord>> {
    if (scope?.role === 'USER' && !scope.branchId) {
      throw new ForbiddenException(
        'Korisnik mora biti vezan za podružnicu da bi pristupio listi zapisnika.',
      );
    }
    const { page, limit, status, meterId } = filter;
    const skip = (page - 1) * limit;
    const scopeClause = scopeWhere(scope, { viaMeter: true });
    const where = {
      ...(status ? { status } : {}),
      ...(meterId ? { meterId } : {}),
      ...(extraWhere ?? {}),
      ...(scopeClause ? { AND: [scopeClause] } : {}),
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
    canSubmitForApproval: boolean;
    canApproveReject: boolean;
    canActivateSep: boolean;
    isApprovalOperator: boolean;
  }> {
    const record = await this.findOne(id, scope);
    const isUserRole = scope?.role === 'USER';
    let isApprovalOperator = false;
    if (isUserRole) {
      const meter = await this.prisma.meter.findUnique({
        where: { id: record.meterId },
        select: { branchId: true },
      });
      const branchId = meter?.branchId ?? null;
      isApprovalOperator = !!branchId
        ? await this.recipientsService.isUserInApprovalGroupForBranch(userId, branchId)
        : false;
    }

    return {
      canSubmitForApproval:
        record.status === RecordStatus.DRAFT &&
        (record.installedById === userId || scope?.role === 'SYSTEM_ADMIN' || scope?.role === 'MODERATOR'),
      canApproveReject:
        record.status === RecordStatus.PENDING &&
        (!isUserRole || isApprovalOperator),
      canActivateSep:
        record.status === RecordStatus.WAITING_SEP_ACTIVATION &&
        (!isUserRole || isApprovalOperator),
      isApprovalOperator,
    };
  }

  private async isUserApprovalOperator(
    userId: string,
    scope?: ScopeContext | null,
  ): Promise<boolean> {
    const where: Prisma.BranchApprovalGroupWhereInput = {
      recipientGroup: {
        type: 'APPROVAL',
        groupUsers: { some: { userId } },
      },
    };
    if (scope?.distributionId) {
      where.branch = { distributionId: scope.distributionId };
    } else if (scope?.branchId) {
      where.branchId = scope.branchId;
    }
    const count = await this.prisma.branchApprovalGroup.count({ where });
    return count > 0;
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

  async approve(id: string, approvedById: string, scope?: ScopeContext | null): Promise<InstallationRecord> {
    const record = await this.findOne(id, scope);
    if (record.status !== RecordStatus.PENDING) {
      throw new BadRequestException(
        `Installation record can only be approved from PENDING status. Current status: ${record.status}`,
      );
    }
    if (scope?.role === 'USER') {
      const meter = await this.prisma.meter.findUnique({
        where: { id: record.meterId },
        select: { branchId: true },
      });
      const branchId = meter?.branchId ?? null;
      if (!branchId) {
        throw new ForbiddenException(
          'Zapisnik nema povezanu podružnicu. Samo moderator ili admin mogu odobriti.',
        );
      }
      const canApprove = await this.recipientsService.isUserInApprovalGroupForBranch(approvedById, branchId);
      if (!canApprove) {
        throw new ForbiddenException(
          'Niste u grupi odobravatelja za ovu podružnicu. Samo članovi grupe mogu odobravati zapisnike.',
        );
      }
    }
    const updated = await this.prisma.installationRecord.update({
      where: { id },
      data: {
        status: RecordStatus.WAITING_SEP_ACTIVATION,
        approvedById,
        approvedAt: new Date(),
      },
    });
    await this.notificationsService.create({
      userId: record.installedById,
      title: 'Zapisnik odobren',
      message: `Zapisnik ${record.recordNumber} je odobren. Čeka aktivaciju u SEP.`,
      type: 'installation_record',
      link: `/installation-records/${id}`,
    });
    await this.activityLogService.log({
      userId: approvedById,
      action: 'APPROVE',
      entity: 'installation_record',
      entityId: id,
      details: { recordNumber: record.recordNumber },
    });
    await this.createSimEventFromInstallationRecord(
      id,
      'APPROVED',
      approvedById,
    );
    return updated;
  }

  async reject(
    id: string,
    rejectionReasonDto: RejectionReasonDto,
    ctx?: InstallationRecordContext,
    scope?: ScopeContext | null,
  ): Promise<InstallationRecord> {
    const record = await this.findOne(id, scope);
    if (record.status !== RecordStatus.PENDING) {
      throw new BadRequestException(
        `Installation record can only be rejected from PENDING status. Current status: ${record.status}`,
      );
    }
    if (scope?.role === 'USER' && ctx?.userId) {
      const meter = await this.prisma.meter.findUnique({
        where: { id: record.meterId },
        select: { branchId: true },
      });
      const branchId = meter?.branchId ?? null;
      if (!branchId) {
        throw new ForbiddenException(
          'Zapisnik nema povezanu podružnicu. Samo moderator ili admin mogu odbiti.',
        );
      }
      const canReject = await this.recipientsService.isUserInApprovalGroupForBranch(ctx.userId, branchId);
      if (!canReject) {
        throw new ForbiddenException(
          'Niste u grupi odobravatelja za ovu podružnicu. Samo članovi grupe mogu odbijati zapisnike.',
        );
      }
    }
    const updated = await this.prisma.installationRecord.update({
      where: { id },
      data: {
        status: RecordStatus.REJECTED,
        rejectionReason: rejectionReasonDto.rejectionReason,
      },
    });
    await this.notificationsService.create({
      userId: record.installedById,
      title: 'Zapisnik odbijen',
      message: `Zapisnik ${record.recordNumber} je odbijen. Razlog: ${rejectionReasonDto.rejectionReason || 'Nije naveden.'}`,
      type: 'installation_record',
      link: `/installation-records/${id}`,
    });
    await this.activityLogService.log({
      userId: ctx?.userId,
      action: 'REJECT',
      entity: 'installation_record',
      entityId: id,
      details: {
        recordNumber: record.recordNumber,
        reason: rejectionReasonDto.rejectionReason,
      },
      ipAddress: ctx?.ipAddress,
    });
    await this.createSimEventFromInstallationRecord(
      id,
      'REJECTED',
      ctx?.userId,
    );
    return updated;
  }

  private serializeRecordForPdf(record: InstallationRecord & {
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
      meterTypeDefinition?: { name: string; manufacturer?: string | null; model?: string | null; type: string; maxCurrent?: string | null } | null;
      simCard?: { iccid: string; ipAddress: string; publicIpAddress?: string | null; phoneNumber?: string | null; apn?: string | null; assignedTo?: { firstName: string; lastName: string } | null } | null;
    } | null;
    installedBy?: { firstName: string; lastName: string } | null;
    approvedBy?: { firstName: string; lastName: string } | null;
  }): Record<string, unknown> {
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
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const photoDataUrls: string[] = [];
    for (const p of photos) {
      if (typeof p !== 'string' || !p.startsWith('installation-records/')) continue;
      const fullPath = path.join(uploadsDir, p);
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
    };
  }

  async generatePdf(id: string, scope?: ScopeContext | null): Promise<Buffer> {
    const installationRecord = await this.findOne(id, scope) as Parameters<InstallationRecordsService['serializeRecordForPdf']>[0];
    const pdfData = this.serializeRecordForPdf(installationRecord);
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

  async sendRecord(
    id: string,
    recipientGroupIds: string[] | undefined,
    manualEmails: string[] | undefined,
    ctx?: InstallationRecordContext,
    scope?: ScopeContext | null,
  ): Promise<InstallationRecord> {
    const record = await this.findOne(id, scope) as Parameters<InstallationRecordsService['serializeRecordForPdf']>[0];
    if (record.status !== RecordStatus.ACTIVATED_IN_SEP) {
      throw new BadRequestException(
        `Zapisnik se može slati samo u statusu ACTIVATED_IN_SEP. Trenutni status: ${record.status}`,
      );
    }

    const emails: string[] = [];
    if (recipientGroupIds?.length) {
      const fromGroups = await this.recipientsService.getActiveEmailsByGroupIds(
        recipientGroupIds,
      );
      emails.push(...fromGroups);
    }
    if (manualEmails?.length) {
      emails.push(...manualEmails);
    }
    const uniqueEmails = [...new Set(emails)].filter((e) => e?.trim());
    if (uniqueEmails.length === 0) {
      throw new BadRequestException(
        'Navedite barem jednu grupu primalaca ili ručne email adrese.',
      );
    }

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
      throw new BadRequestException(`Slanje nije uspjelo: ${msg}`);
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
      details: {
        recordNumber: record.recordNumber,
        sentTo: uniqueEmails,
      },
      ipAddress: ctx?.ipAddress,
    });

    await this.createSimEventFromInstallationRecord(
      id,
      'SENT',
      ctx?.userId,
    );

    return updated;
  }

  async submitForApproval(
    id: string,
    ctx?: InstallationRecordContext,
    scope?: ScopeContext | null,
  ): Promise<InstallationRecord> {
    const record = await this.findOne(id, scope) as Parameters<InstallationRecordsService['serializeRecordForPdf']>[0];
    if (record.status !== RecordStatus.DRAFT) {
      throw new BadRequestException(
        `Zapisnik se može slati na odobrenje samo iz statusa DRAFT. Trenutni: ${record.status}`,
      );
    }
    const meter = record.meter as { branchId?: string } | null;
    const installer = record.installedBy as { branchId?: string } | null;
    const branchId = meter?.branchId ?? installer?.branchId;
    if (!branchId) {
      throw new BadRequestException(
        'Zapisnik nema povezanu podružnicu. Nemoguće odrediti grupu za odobrenje.',
      );
    }
    const approvalGroup = await this.recipientsService.getApprovalGroupForBranch(branchId);
    if (!approvalGroup) {
      throw new BadRequestException(
        'Nije definisana grupa za odobrenje za ovu podružnicu. Moderator treba postaviti mapiranje podružnica.',
      );
    }
    const { emails, userIds } = await this.recipientsService.getEmailsAndUserIdsForGroup(
      approvalGroup.id,
    );
    if (emails.length === 0) {
      throw new BadRequestException(
        'Grupa za odobrenje nema primalaca. Dodajte Recipients ili korisnike aplikacije u grupu.',
      );
    }
    const installedByName = record.installedBy
      ? `${(record.installedBy as { firstName: string }).firstName} ${(record.installedBy as { lastName: string }).lastName}`
      : 'Nepoznato';
    try {
      await this.mailService.sendApprovalRequest({
        to: emails,
        recordNumber: record.recordNumber,
        recordId: id,
        meterSerialNumber: record.meter?.serialNumber ?? '–',
        ipAddress: record.meter?.simCard?.ipAddress ?? '–',
        installationAddress: record.meter?.installationAddress ?? '',
        municipality: record.meter?.municipality ?? '',
        installedByName,
      });
    } catch (err) {
      await this.prisma.installationRecord.update({
        where: { id },
        data: { status: RecordStatus.SUBMIT_FAILED },
      });
      const msg = err instanceof Error ? err.message : 'Slanje email-a nije uspjelo';
      throw new BadRequestException(`Slanje na odobrenje nije uspjelo: ${msg}`);
    }
    const updated = await this.prisma.installationRecord.update({
      where: { id },
      data: { status: RecordStatus.PENDING },
    });
    // In-app notifikacija za sve User-e u grupi (RecipientGroupUser)
    for (const uid of userIds) {
      await this.notificationsService.create({
        userId: uid,
        title: 'Novi zapisnik na odobrenje',
        message: `Zapisnik ${record.recordNumber} od ${installedByName} čeka vaše odobrenje.`,
        type: 'installation_record',
        link: `/installation-records/${id}`,
      });
    }
    await this.activityLogService.log({
      userId: ctx?.userId,
      action: 'SUBMIT_FOR_APPROVAL',
      entity: 'installation_record',
      entityId: id,
      details: { recordNumber: record.recordNumber, sentTo: emails },
      ipAddress: ctx?.ipAddress,
    });
    await this.createSimEventFromInstallationRecord(
      id,
      'SUBMITTED_FOR_APPROVAL',
      ctx?.userId,
    );
    return updated;
  }

  async activateInSep(
    id: string,
    ctx?: InstallationRecordContext,
    scope?: ScopeContext | null,
  ): Promise<InstallationRecord> {
    const record = await this.findOne(id, scope);
    if (record.status !== RecordStatus.WAITING_SEP_ACTIVATION) {
      throw new BadRequestException(
        `Zapisnik se može aktivirati samo iz statusa WAITING_SEP_ACTIVATION. Trenutni: ${record.status}`,
      );
    }
    if (scope?.role === 'USER' && ctx?.userId) {
      const meter = await this.prisma.meter.findUnique({
        where: { id: record.meterId },
        select: { branchId: true },
      });
      const branchId = meter?.branchId ?? null;
      if (!branchId) {
        throw new ForbiddenException(
          'Zapisnik nema povezanu podružnicu. Samo moderator ili admin mogu aktivirati u SEP.',
        );
      }
      const canActivate = await this.recipientsService.isUserInApprovalGroupForBranch(ctx.userId, branchId);
      if (!canActivate) {
        throw new ForbiddenException(
          'Niste u grupi odobravatelja za ovu podružnicu. Samo članovi grupe mogu aktivirati zapisnik u SEP.',
        );
      }
    }
    const updated = await this.prisma.installationRecord.update({
      where: { id },
      data: { status: RecordStatus.ACTIVATED_IN_SEP },
    });
    await this.notificationsService.create({
      userId: record.installedById,
      title: 'Zapisnik aktiviran u SEP',
      message: `Zapisnik ${record.recordNumber} je označen kao aktiviran u SEP. Možete ga ručno poslati sa PDF-om.`,
      type: 'installation_record',
      link: `/installation-records/${id}`,
    });
    await this.activityLogService.log({
      userId: ctx?.userId,
      action: 'ACTIVATE_SEP',
      entity: 'installation_record',
      entityId: id,
      details: { recordNumber: record.recordNumber },
      ipAddress: ctx?.ipAddress,
    });
    await this.createSimEventFromInstallationRecord(
      id,
      'ACTIVATED_IN_SEP',
      ctx?.userId,
    );
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
