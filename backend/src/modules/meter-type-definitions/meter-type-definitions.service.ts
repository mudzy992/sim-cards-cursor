import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MeterTypeDefinition } from '@prisma/client';
import { CreateMeterTypeDefinitionDto } from './dto/create-meter-type-definition.dto';
import { UpdateMeterTypeDefinitionDto } from './dto/update-meter-type-definition.dto';

@Injectable()
export class MeterTypeDefinitionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.meterTypeDefinition.findMany({
      orderBy: { name: 'asc' },
      include: { fields: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async findOne(id: string) {
    const item = await this.prisma.meterTypeDefinition.findUnique({
      where: { id },
      include: { fields: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!item) {
      throw new NotFoundException(`Tip brojila s ID ${id} nije pronađen.`);
    }
    return item;
  }

  async create(dto: CreateMeterTypeDefinitionDto): Promise<MeterTypeDefinition> {
    return this.prisma.meterTypeDefinition.create({
      data: {
        name: dto.name,
        manufacturer: dto.manufacturer,
        model: dto.model,
        type: dto.type ?? 'SINGLE_PHASE',
        maxCurrent: dto.maxCurrent,
        notes: dto.notes,
      },
    });
  }

  async update(
    id: string,
    dto: UpdateMeterTypeDefinitionDto,
  ): Promise<MeterTypeDefinition> {
    await this.findOne(id);
    return this.prisma.meterTypeDefinition.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.manufacturer !== undefined && { manufacturer: dto.manufacturer }),
        ...(dto.model !== undefined && { model: dto.model }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.maxCurrent !== undefined && { maxCurrent: dto.maxCurrent }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  async remove(id: string): Promise<MeterTypeDefinition> {
    await this.findOne(id);
    return this.prisma.meterTypeDefinition.delete({
      where: { id },
    });
  }
}
