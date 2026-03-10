import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ShipmentStatus, SimCardStatus } from '@prisma/client';
import { scopeWhere, ScopeContext } from '../../common/utils/scope-filter.util';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { ImportExcelDto } from './dto/import-excel.dto';
import { ColumnMapperService, ImportDomainKey } from './import/column-mapper.service';
import { ExcelImportService } from './import/excel-import.service';
import { ShipmentFilterDto } from './dto/shipment-filter.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';

@Injectable()
export class ShipmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogService: ActivityLogService,
    private readonly columnMapperService: ColumnMapperService,
    private readonly excelImportService: ExcelImportService,
  ) {}

  async create(dto: CreateShipmentDto, actorId: string, ipAddress?: string, scope?: ScopeContext | null) {
    const distributionId =
      scope?.role === 'MODERATOR' && scope.distributionId
        ? scope.distributionId
        : dto.distributionId;
    if (scope?.role === 'SYSTEM_ADMIN' && !distributionId) {
      throw new BadRequestException('Distribucija je obavezna pri kreiranju isporuke.');
    }
    const shipment = await this.prisma.shipment.create({
      data: {
        name: dto.name,
        provider: dto.provider,
        receivedDate: new Date(dto.receivedDate),
        totalCards: dto.totalCards,
        notes: dto.notes,
        originalFileName: dto.originalFileName,
        distributionId: distributionId ?? undefined,
        importedById: actorId,
      },
      include: {
        importedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    await this.activityLogService.log({
      userId: actorId,
      action: 'CREATE',
      entity: 'shipment',
      entityId: shipment.id,
      details: { name: shipment.name, provider: shipment.provider },
      ipAddress,
    });

    return shipment;
  }

  async findAll(filter: ShipmentFilterDto, scope?: ScopeContext | null): Promise<PaginatedResult<unknown>> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;

    const scopeClause = scopeWhere(scope, { distributionIdField: 'distributionId' });
    const where: Prisma.ShipmentWhereInput = {
      ...(scopeClause ? { AND: [scopeClause] } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.provider ? { provider: { contains: filter.provider } } : {}),
      ...(filter.search
        ? {
            OR: [
              { name: { contains: filter.search } },
              { provider: { contains: filter.search } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.shipment.findMany({
        where,
        include: {
          importedBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          _count: {
            select: { simCards: true },
          },
        },
        orderBy: { receivedDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.shipment.count({ where }),
    ]);

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findOne(id: string, scope?: ScopeContext | null) {
    const scopeClause = scopeWhere(scope, { distributionIdField: 'distributionId' });
    const shipment = await this.prisma.shipment.findFirst({
      where: {
        id,
        ...(scopeClause ? { AND: [scopeClause] } : {}),
      },
      include: {
        importedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: { simCards: true },
        },
      },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    return shipment;
  }

  async update(id: string, dto: UpdateShipmentDto, actorId: string, ipAddress?: string, scope?: ScopeContext | null) {
    await this.ensureShipmentExists(id, scope);

    const updated = await this.prisma.shipment.update({
      where: { id },
      data: {
        name: dto.name,
        provider: dto.provider,
        receivedDate: dto.receivedDate ? new Date(dto.receivedDate) : undefined,
        totalCards: dto.totalCards,
        notes: dto.notes,
        originalFileName: dto.originalFileName,
        ...(dto.distributionId !== undefined ? { distributionId: dto.distributionId } : {}),
      },
      include: {
        importedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    await this.activityLogService.log({
      userId: actorId,
      action: 'UPDATE',
      entity: 'shipment',
      entityId: id,
      details: { fields: Object.keys(dto) },
      ipAddress,
    });

    return updated;
  }

  async remove(id: string, actorId: string, ipAddress?: string, scope?: ScopeContext | null) {
    const scopeClause = scopeWhere(scope, { distributionIdField: 'distributionId' });
    const shipment = await this.prisma.shipment.findFirst({
      where: {
        id,
        ...(scopeClause ? { AND: [scopeClause] } : {}),
      },
      include: {
        _count: {
          select: { simCards: true },
        },
      },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    if (shipment._count.simCards > 0) {
      throw new BadRequestException('Shipment cannot be deleted while it contains SIM cards');
    }

    await this.prisma.shipment.delete({ where: { id } });

    await this.activityLogService.log({
      userId: actorId,
      action: 'DELETE',
      entity: 'shipment',
      entityId: id,
      ipAddress,
    });

    return { deleted: true };
  }

  async findShipmentSimCards(
    id: string,
    pagination: PaginationDto,
    scope?: ScopeContext | null,
  ): Promise<PaginatedResult<unknown>> {
    await this.ensureShipmentExists(id, scope);

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.simCard.findMany({
        where: { shipmentId: id },
        include: {
          assignedTo: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          shipment: {
            select: {
              id: true,
              name: true,
              provider: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.simCard.count({ where: { shipmentId: id } }),
    ]);

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async importExcel(
    shipmentId: string,
    dto: ImportExcelDto,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number } | undefined,
    actorId: string,
    ipAddress?: string,
    scope?: ScopeContext | null,
  ) {
    await this.ensureShipmentExists(shipmentId, scope);

    if (!file?.buffer || file.size <= 0) {
      throw new BadRequestException('Uploaded file is required');
    }

    if (!this.isSupportedFile(file.originalname, file.mimetype)) {
      throw new BadRequestException('Only .xlsx, .xls, and .csv files are supported');
    }

    const parsed = this.excelImportService.parse(file.buffer);
    const suggested = this.columnMapperService.suggest(parsed.headers);
    const providedMapping = this.parseMappingInput(dto.columnMapping);
    const resolvedMapping = this.columnMapperService.merge(suggested, providedMapping);
    const existingIccids = await this.fetchExistingIccids();

    const preview = this.excelImportService.preview(
      parsed,
      resolvedMapping,
      existingIccids,
    );

    const applyImport = dto.applyImport === 'true';
    if (!applyImport) {
      return {
        mode: 'preview',
        ...preview,
      };
    }

    if (!preview.canImport) {
      throw new BadRequestException({
        message: 'Import cannot be applied because preview contains invalid rows',
        preview,
      });
    }

    const validation = this.excelImportService.validate(
      parsed,
      resolvedMapping,
      existingIccids,
    );

    const createManyData = this.excelImportService.toCreateManyData(
      validation.rows,
      shipmentId,
    );

    const inserted = await this.prisma.simCard.createMany({
      data: createManyData.map((item) => ({
        ...item,
        status: SimCardStatus.AVAILABLE,
      })),
      skipDuplicates: true,
    });

    const shipmentSimTotal = await this.prisma.simCard.count({
      where: { shipmentId },
    });

    await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        totalCards: shipmentSimTotal,
        status: ShipmentStatus.COMPLETED,
      },
    });

    await this.activityLogService.log({
      userId: actorId,
      action: 'IMPORT',
      entity: 'shipment',
      entityId: shipmentId,
      details: {
        fileName: file.originalname,
        inserted: inserted.count,
        totalRows: validation.summary.totalRows,
      },
      ipAddress,
    });

    return {
      mode: 'import',
      fileName: file.originalname,
      insertedRows: inserted.count,
      totalRows: validation.summary.totalRows,
      summary: validation.summary,
      resolvedMapping,
    };
  }

  private async ensureShipmentExists(id: string, scope?: ScopeContext | null): Promise<void> {
    const scopeClause = scopeWhere(scope, { distributionIdField: 'distributionId' });
    const shipment = await this.prisma.shipment.findFirst({
      where: {
        id,
        ...(scopeClause ? { AND: [scopeClause] } : {}),
      },
      select: { id: true },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }
  }

  private parseMappingInput(
    raw: string | undefined,
  ): Partial<Record<ImportDomainKey, string>> | undefined {
    if (!raw) {
      return undefined;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<Record<ImportDomainKey, string>>;
      return parsed;
    } catch {
      throw new BadRequestException('columnMapping must be valid JSON');
    }
  }

  private async fetchExistingIccids(): Promise<Set<string>> {
    const existing = await this.prisma.simCard.findMany({
      select: { iccid: true },
    });
    return new Set(existing.map((item) => item.iccid));
  }

  private isSupportedFile(fileName: string, mimeType: string): boolean {
    const lowered = fileName.toLowerCase();
    const byExtension =
      lowered.endsWith('.xlsx') || lowered.endsWith('.xls') || lowered.endsWith('.csv');

    const byMime = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/csv',
      'application/octet-stream',
    ].includes(mimeType);

    return byExtension || byMime;
  }

}
