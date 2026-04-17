import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { scopeWhere, ScopeContext } from 'src/common/utils/scope-filter.util';
import { CreateMeterDto } from './dto/create-meter.dto';
import { UpdateMeterDto } from './dto/update-meter.dto';
import { Meter, MeterSimCardState, Prisma } from '@prisma/client';
import { MeterFilterDto } from './dto/meter-filter.dto';
import { PaginatedResult } from 'src/common/interfaces/paginated-result.interface';
import { MeterTypeFieldsService } from '../meter-type-definitions/meter-type-fields.service';

@Injectable()
export class MetersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly meterTypeFieldsService: MeterTypeFieldsService,
  ) {}

  async create(createMeterDto: CreateMeterDto): Promise<Meter> {
    const data: Record<string, unknown> = {
      serialNumber: createMeterDto.serialNumber,
      meterTypeDefinitionId: createMeterDto.meterTypeDefinitionId,
    };
    if (createMeterDto.year != null) data.year = createMeterDto.year;
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
    const { page, limit, meterTypeDefinitionId, serialNumber } = filter;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {};
    if (meterTypeDefinitionId) where.meterTypeDefinitionId = meterTypeDefinitionId;
    if (serialNumber?.trim()) {
      where.serialNumber = { contains: serialNumber.trim() };
    }
    const scopeClause = scopeWhere(scope, { branchIdField: 'branchId' });
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
    const scopeClause = scopeWhere(scope, { branchIdField: 'branchId' });
    const meter = await this.prisma.meter.findFirst({
      where: {
        id,
        ...(scopeClause ? { AND: [scopeClause] } : {}),
      },
      include: {
        meterTypeDefinition: true,
        simCard: { include: { assignedTo: true } },
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
    const data: Record<string, unknown> = { ...updateMeterDto };
    if (data.installationDate && typeof data.installationDate === 'string') {
      data.installationDate = new Date(data.installationDate as string);
    }
    if (data.branchId !== undefined) (data as Record<string, unknown>).branchId = data.branchId;

    const simCardId = updateMeterDto.simCardId;
    const simCardState = updateMeterDto.simCardState;
    if (simCardId) {
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

  /** Sva brojila – pri kreiranju zapisnika bira se brojilo i SIM (zapisnik = pridruživanje SIM brojilu). */
  async findAvailable(scope?: ScopeContext | null) {
    const scopeClause = scopeWhere(scope, { branchIdField: 'branchId' });
    return this.prisma.meter.findMany({
      where: scopeClause ? { AND: [scopeClause] } : undefined,
      orderBy: [{ meterTypeDefinition: { name: 'asc' } }, { serialNumber: 'asc' }],
      include: { meterTypeDefinition: true },
    });
  }
}

