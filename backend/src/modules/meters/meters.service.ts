import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { scopeWhere, ScopeContext } from 'src/common/utils/scope-filter.util';
import { CreateMeterDto } from './dto/create-meter.dto';
import { UpdateMeterDto } from './dto/update-meter.dto';
import { Meter, MeterSimCardState, MeterStatus, Prisma } from '@prisma/client';
import { MeterFilterDto } from './dto/meter-filter.dto';
import { PaginatedResult } from 'src/common/interfaces/paginated-result.interface';
import { MeterTypeFieldsService } from '../meter-type-definitions/meter-type-fields.service';
import {
  assertMeterYearsPairIfPartial,
  assertMeterYearsRequired,
} from 'src/common/utils/meter-years.util';
import { UserRole } from '@prisma/client';
import { DeleteMeterDto, MeterDeleteRecordsAction, MeterDeleteSimAction } from './dto/delete-meter.dto';
import { AuthService } from '../auth/auth.service';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

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
  ) {}

  private uploadsRoot(): string {
    return this.config.get<string>('UPLOAD_ROOT_PATH', path.join(process.cwd(), 'uploads'));
  }

  private safeRmDirRecursive(absolutePath: string): void {
    const uploadsRoot = path.resolve(this.uploadsRoot());
    const resolved = path.resolve(absolutePath);
    if (!resolved.startsWith(uploadsRoot)) {
      return;
    }
    if (!fs.existsSync(resolved)) return;
    fs.rmSync(resolved, { recursive: true, force: true });
  }

  async create(createMeterDto: CreateMeterDto): Promise<Meter> {
    assertMeterYearsRequired(
      createMeterDto.year,
      createMeterDto.calibrationYear,
      'brojilo',
    );
    const data: Record<string, unknown> = {
      serialNumber: createMeterDto.serialNumber,
      meterTypeDefinitionId: createMeterDto.meterTypeDefinitionId,
    };
    if (createMeterDto.status) data.status = createMeterDto.status
    if (createMeterDto.year != null) data.year = createMeterDto.year;
    if (createMeterDto.calibrationYear != null) data.calibrationYear = createMeterDto.calibrationYear;
    if (createMeterDto.notes != null) data.notes = createMeterDto.notes;
    if (createMeterDto.installationAddress != null)
      data.installationAddress = createMeterDto.installationAddress;
    if (createMeterDto.installationDate) {
      data.installationDate = new Date(createMeterDto.installationDate);
    }
    if (createMeterDto.city != null) data.city = createMeterDto.city;
    if (createMeterDto.municipality != null) data.municipality = createMeterDto.municipality;
    if (createMeterDto.measuringPoint != null)
      data.measuringPoint = createMeterDto.measuringPoint;
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
        throw new BadRequestException('simCardState=INSTALLED nije dozvoljen bez procesa ugradnje SIM-a.');
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

    return this.prisma.meter.create({
      data: data as Parameters<typeof this.prisma.meter.create>[0]['data'],
    });
  }

  async findAll(
    filter: MeterFilterDto,
    scope?: ScopeContext | null,
  ): Promise<PaginatedResult<Meter & { meterTypeDefinition?: unknown }>> {
    const { page, limit, meterTypeDefinitionId, serialNumber, simCardState } = filter;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {};
    if (meterTypeDefinitionId) where.meterTypeDefinitionId = meterTypeDefinitionId;
    if (serialNumber?.trim()) {
      where.serialNumber = { contains: serialNumber.trim(), mode: 'insensitive' };
    }
    if (simCardState) {
      where.simCardState = simCardState;
    }
    const scopeClause = this.getMetersReadScopeClause(scope);
    if (scopeClause) {
      where.AND = where.AND ? [...(Array.isArray(where.AND) ? where.AND : [where.AND]), scopeClause] : [scopeClause];
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
        simCard: { include: { assignedTo: true } },
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

  async update(id: string, updateMeterDto: UpdateMeterDto, scope?: ScopeContext | null): Promise<Meter> {
    const scopeClause = scopeWhere(scope, { branchIdField: 'branchId' });
    if (scopeClause) {
      const exists = await this.prisma.meter.findFirst({
        where: { id, AND: [scopeClause] },
        select: { id: true },
      });
      if (!exists) throw new NotFoundException(`Meter with ID ${id} not found`);
    }
    const currentYears = await this.prisma.meter.findUnique({
      where: { id },
      select: { year: true, calibrationYear: true },
    });
    const mergedYear =
      updateMeterDto.year !== undefined ? updateMeterDto.year : currentYears?.year ?? undefined;
    const mergedCalibration =
      updateMeterDto.calibrationYear !== undefined
        ? updateMeterDto.calibrationYear
        : currentYears?.calibrationYear ?? undefined;
    assertMeterYearsPairIfPartial(mergedYear, mergedCalibration);
    const data: Record<string, unknown> = { ...updateMeterDto };
    if (data.installationDate && typeof data.installationDate === 'string') {
      data.installationDate = new Date(data.installationDate as string);
    }
    if (data.branchId !== undefined) (data as Record<string, unknown>).branchId = data.branchId;

    const simCardId = updateMeterDto.simCardId;
    const simCardState = updateMeterDto.simCardState;
    if (simCardId) {
      const existing = await this.prisma.meter.findUnique({ where: { id }, select: { status: true } })
      if (existing?.status && existing.status !== MeterStatus.ACTIVE) {
        throw new BadRequestException('Nije dozvoljeno ugraditi SIM na brojilo koje nije aktivno.')
      }
      data.simCardState = MeterSimCardState.INSTALLED;
      data.noSimReason = null;
    }
    if (simCardId === null) {
      data.simCardState = MeterSimCardState.NO_SIM;
      data.noSimReason = updateMeterDto.noSimReason ?? null;
    }
    if (simCardState) {
      if (simCardState === MeterSimCardState.INSTALLED && !simCardId) {
        throw new BadRequestException('simCardState=INSTALLED zahtijeva simCardId.');
      }
      if (simCardState === MeterSimCardState.NO_SIM) {
        data.simCardId = null;
        data.noSimReason = updateMeterDto.noSimReason ?? null;
      }
      data.simCardState = simCardState;
    }

    if (updateMeterDto.dynamicFieldValues !== undefined) {
      const meter = await this.prisma.meter.findUnique({
        where: { id },
        select: { meterTypeDefinitionId: true },
      });
      if (meter) {
        const validated = await this.meterTypeFieldsService.validateDynamicValues(
          meter.meterTypeDefinitionId,
          updateMeterDto.dynamicFieldValues ?? null,
        );
        data.dynamicFieldValues = Object.keys(validated).length > 0 ? validated : Prisma.DbNull;
      }
    }

    try {
      return await this.prisma.meter.update({
        where: { id },
        data: data as Parameters<typeof this.prisma.meter.update>[0]['data'],
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException(`Meter with ID ${id} not found`);
      }
      throw error;
    }
  }

  async remove(id: string, scope?: ScopeContext | null): Promise<Meter> {
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
      throw new NotFoundException(`Meter with ID ${id} not found`);
    }

    const records = await this.prisma.installationRecord.findMany({
      where: { meterId: id },
      select: { id: true, createdAt: true, pdfPath: true, photos: true },
      orderBy: { createdAt: 'desc' },
    });

    if (records.length > 0 && dto.recordsAction === MeterDeleteRecordsAction.ABORT_IF_EXISTS) {
      throw new BadRequestException('Brojilo ima zapisnike. Preuzmite zapisnike pa odaberite brisanje zapisnika.');
    }

    const baseDirsToCleanup = new Set<string>();
    const collectBaseDir = (p: string) => {
      const parts = p.split(/[\\/]+/).filter(Boolean);
      // expected: installation-records/<year>/<serial>/...
      if (parts.length < 3) return;
      if (parts[0] !== 'installation-records') return;
      baseDirsToCleanup.add(path.join(this.uploadsRoot(), parts[0], parts[1], parts[2]));
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
      // SIM handling (optional)
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

      // Meter delete (install/demount tasks cascade)
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
      for (const dir of baseDirsToCleanup) {
        this.safeRmDirRecursive(dir);
      }
    }

    return result;
  }

  /** Sva brojila – pri kreiranju zapisnika bira se brojilo i SIM (zapisnik = pridruživanje SIM brojilu). */
  async findAvailable(scope?: ScopeContext | null) {
    const scopeClause = this.getMetersReadScopeClause(scope);
    return this.prisma.meter.findMany({
      where: scopeClause ? { AND: [scopeClause] } : undefined,
      orderBy: [{ meterTypeDefinition: { name: 'asc' } }, { serialNumber: 'asc' }],
      include: { meterTypeDefinition: true },
    });
  }

  private getMetersReadScopeClause(scope?: ScopeContext | null) {
    if (
      scope?.role === UserRole.USER &&
      (scope.branchModeratorBranchIds?.length ?? 0) > 0
    ) {
      if (scope.distributionId) {
        return { branch: { distributionId: scope.distributionId } };
      }
      // Fallback (shouldn't happen in normal data): behave like normal USER scope.
      return scopeWhere(scope, { branchIdField: 'branchId' });
    }
    return scopeWhere(scope, { branchIdField: 'branchId' });
  }
}

