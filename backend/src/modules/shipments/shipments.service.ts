import {
  BadRequestException,
  ConflictException,
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
    if (scope?.role === 'DIST_ADMIN' && !scope.distributionId) {
      throw new BadRequestException('Distribution admin scope is missing.');
    }
    const distributionId =
      scope?.role === 'DIST_ADMIN' && scope.distributionId
        ? scope.distributionId
        : dto.distributionId;
    if (scope?.role === 'SYSTEM_ADMIN') {
      if (!distributionId) {
        throw new BadRequestException('Distribucija je obavezna pri kreiranju isporuke.');
      }
      const distribution = await this.prisma.distribution.findUnique({
        where: { id: distributionId },
        select: { id: true },
      });
      if (!distribution) {
        throw new BadRequestException(
          'Odabrana distribucija ne postoji u bazi. Osvježite stranicu i odaberite ponovo.',
        );
      }
    }
    const shipment = await this.prisma.shipment.create({
      data: {
        name: dto.name,
        provider: dto.provider,
        receivedDate: new Date(dto.receivedDate),
        totalCards: dto.totalCards ?? 0,
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
              { name: { contains: filter.search} },
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
    const isSystemAdmin = scope?.role === 'SYSTEM_ADMIN';
    const scopeClause = scopeWhere(scope, { distributionIdField: 'distributionId' });

    const shipment = await this.prisma.shipment.findFirst({
      where: { id, ...(scopeClause ? { AND: [scopeClause] } : {}) },
      include: {
        _count: { select: { simCards: true } },
        simCards: { select: { id: true, iccid: true, status: true } },
      },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    const simCount = shipment._count.simCards;

    // ── Prazna isporuka: postojeće ponašanje (SYSTEM_ADMIN i DIST_ADMIN) ──
    if (simCount === 0) {
      await this.prisma.shipment.delete({ where: { id } });
      await this.activityLogService.log({
        userId: actorId,
        action: 'DELETE',
        entity: 'shipment',
        entityId: id,
        details: { name: shipment.name, provider: shipment.provider, deletedSimCards: 0 },
        ipAddress,
      });
      return { deleted: true, deletedSimCards: 0, deletedSimEvents: 0 };
    }

    // ── Kompletna isporuka: isključivo SYSTEM_ADMIN ──
    if (!isSystemAdmin) {
      throw new BadRequestException(
        'Kompletnu isporuku sa SIM karticama može obrisati samo sistem administrator.',
      );
    }

    // ── Sigurnosna pravila: kartice u operativnoj upotrebi ne smiju nestati ──
    const simCardIds = shipment.simCards.map((c) => c.id);
    const operationalCount = shipment.simCards.filter(
      (c) => c.status === SimCardStatus.ASSIGNED || c.status === SimCardStatus.INSTALLED,
    ).length;

    const [metersCount, installationRecordsCount] = await this.prisma.$transaction([
      this.prisma.meter.count({ where: { simCardId: { in: simCardIds } } }),
      this.prisma.installationRecord.count({ where: { simCardId: { in: simCardIds } } }),
    ]);

    if (operationalCount > 0 || metersCount > 0 || installationRecordsCount > 0) {
      throw new BadRequestException(
        `Isporuku nije moguće obrisati: ${operationalCount} kartica je dodijeljeno/ugrađeno, ` +
          `${metersCount} je povezano na brojila, ${installationRecordsCount} ima evidencije ugradnje. ` +
          `Prvo ih demontirajte/deaktivirajte.`,
      );
    }

    // ── Transakcijsko brisanje (FK su RESTRICT → redoslijed je bitan) ──
    const { deletedSimCards, deletedSimEvents } = await this.prisma.$transaction(async (tx) => {
      const events = await tx.simEvent.deleteMany({ where: { simCardId: { in: simCardIds } } });
      const cards = await tx.simCard.deleteMany({ where: { shipmentId: id } });
      await tx.shipment.delete({ where: { id } });
      return { deletedSimCards: cards.count, deletedSimEvents: events.count };
    });

    await this.activityLogService.log({
      userId: actorId,
      action: 'DELETE',
      entity: 'shipment',
      entityId: id,
      details: {
        name: shipment.name,
        provider: shipment.provider,
        deletedSimCards,
        deletedSimEvents,
      },
      ipAddress,
    });

    return { deleted: true, deletedSimCards, deletedSimEvents };
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
      throw new BadRequestException('Fajl je obavezan za import.');
    }

    if (!this.isSupportedFile(file.originalname, file.mimetype)) {
      throw new BadRequestException('Nepodržan format fajla. Dozvoljeno: .xlsx, .xls, .csv');
    }

    const parsed = this.excelImportService.parse(file.buffer);
    const resolvedMapping = this.columnMapperService.merge(
      this.columnMapperService.suggest(parsed.headers),
      this.parseMappingInput(dto.columnMapping),
    );
    const existing = await this.fetchExistingIccidMap();

    if (dto.applyImport !== 'true') {
      const preview = this.excelImportService.preview(parsed, resolvedMapping, existing);
      return {
        mode: 'preview' as const,
        ...preview,
      };
    }

    const validation = this.excelImportService.validate(parsed, resolvedMapping, existing);

    let selectedRowNumbers: number[] | undefined;
    if (dto.selectedRowNumbers) {
      try {
        const raw = JSON.parse(dto.selectedRowNumbers) as unknown;
        if (!Array.isArray(raw) || raw.some((n) => typeof n !== 'number')) {
          throw new Error('invalid');
        }
        selectedRowNumbers = raw as number[];
      } catch {
        throw new BadRequestException('selectedRowNumbers must be a JSON array of numbers');
      }
    }

    const data = this.excelImportService.toCreateManyData(
      validation.rows,
      shipmentId,
      selectedRowNumbers,
    );

    if (data.length === 0) {
      throw new BadRequestException('Nije odabran nijedan ispravan red za import.');
    }

    let inserted: { count: number };
    try {
      inserted = await this.prisma.simCard.createMany({
        data: data.map((item) => ({ ...item, status: SimCardStatus.AVAILABLE })),
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Import sadrži ICCID koji već postoji u bazi (globalno).');
      }
      throw error;
    }

    const shipmentSimTotal = await this.prisma.simCard.count({
      where: { shipmentId },
    });
    await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        totalCards: shipmentSimTotal,
        status: ShipmentStatus.COMPLETED,
        originalFileName: file.originalname,
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
        skipped: validation.summary.totalRows - inserted.count,
        totalRows: validation.summary.totalRows,
        selectedRows: selectedRowNumbers?.length ?? validation.summary.validRows,
        duplicatesInFile: validation.summary.duplicatesInFile,
        duplicatesInDatabase: validation.summary.duplicatesInDatabase,
      },
      ipAddress,
    });

    return {
      mode: 'import' as const,
      fileName: file.originalname,
      insertedRows: inserted.count,
      skippedRows: validation.summary.totalRows - inserted.count,
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

  private async fetchExistingIccidMap(): Promise<Map<string, { shipmentId: string; shipmentName: string; receivedDate: Date }>> {
    const existing = await this.prisma.simCard.findMany({
      select: {
        iccid: true,
        shipment: { select: { id: true, name: true, receivedDate: true } },
      },
    });
    return new Map(
      existing.map((item) => [
        item.iccid,
        { shipmentId: item.shipment.id, shipmentName: item.shipment.name, receivedDate: item.shipment.receivedDate },
      ]),
    );
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
