import {
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { MeterTypeDefinition, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { CreateMeterTypeDefinitionDto } from './dto/create-meter-type-definition.dto';
import { UpdateMeterTypeDefinitionDto } from './dto/update-meter-type-definition.dto';

@Injectable()
export class MeterTypeDefinitionsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly activityLogService?: ActivityLogService,
  ) {}

  async findAll() {
    return this.prisma.meterTypeDefinition.findMany({
      orderBy: { name: 'asc' },
      include: {
        fields: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { meters: true } },
      },
    });
  }

  async findOne(id: string) {
    const item = await this.prisma.meterTypeDefinition.findUnique({
      where: { id },
      include: {
        fields: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { meters: true } },
      },
    });
    if (!item) {
      throw new NotFoundException(`Tip brojila s ID ${id} nije pronađen.`);
    }
    return item;
  }

  async create(
    dto: CreateMeterTypeDefinitionDto,
    actorId?: string,
    ipAddress?: string,
  ): Promise<MeterTypeDefinition> {
    const created = await this.prisma.meterTypeDefinition.create({
      data: {
        name: dto.name.trim(),
        manufacturer: dto.manufacturer?.trim() || undefined,
        model: dto.model?.trim() || undefined,
        type: dto.type ?? 'SINGLE_PHASE',
        maxCurrent: dto.maxCurrent?.trim() || undefined,
        notes: dto.notes?.trim() || undefined,
      },
    });

    if (this.activityLogService) {
      await this.activityLogService.log({
        userId: actorId,
        action: 'CREATE',
        entity: 'meter_type_definition',
        entityId: created.id,
        details: { name: created.name, type: created.type },
        ipAddress,
      });
    }

    return created;
  }

  async update(
    id: string,
    dto: UpdateMeterTypeDefinitionDto,
    actorId?: string,
    ipAddress?: string,
  ): Promise<MeterTypeDefinition> {
    await this.findOne(id);
    const updated = await this.prisma.meterTypeDefinition.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.manufacturer !== undefined && {
          manufacturer: dto.manufacturer?.trim() || null,
        }),
        ...(dto.model !== undefined && { model: dto.model?.trim() || null }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.maxCurrent !== undefined && {
          maxCurrent: dto.maxCurrent?.trim() || null,
        }),
        ...(dto.notes !== undefined && { notes: dto.notes?.trim() || null }),
      },
    });

    if (this.activityLogService) {
      await this.activityLogService.log({
        userId: actorId,
        action: 'UPDATE',
        entity: 'meter_type_definition',
        entityId: id,
        details: { fields: Object.keys(dto) },
        ipAddress,
      });
    }

    return updated;
  }

  async remove(
    id: string,
    actorId?: string,
    ipAddress?: string,
  ): Promise<MeterTypeDefinition> {
    const existing = await this.findOne(id);
    const attachedMetersCount = await this.prisma.meter.count({
      where: { meterTypeDefinitionId: id },
    });
    if (attachedMetersCount > 0) {
      throw new ConflictException(
        `Ne možete obrisati tip brojila jer ga koristi ${attachedMetersCount} brojila.`,
      );
    }

    try {
      const deleted = await this.prisma.meterTypeDefinition.delete({
        where: { id },
      });

      if (this.activityLogService) {
        await this.activityLogService.log({
          userId: actorId,
          action: 'DELETE',
          entity: 'meter_type_definition',
          entityId: id,
          details: { name: existing.name },
          ipAddress,
        });
      }

      return deleted;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          'Ne možete obrisati tip brojila koji je dodijeljen postojećim brojilima.',
        );
      }
      throw error;
    }
  }
}
