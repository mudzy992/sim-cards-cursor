import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDistributionDto } from './dto/create-distribution.dto';
import { UpdateDistributionDto } from './dto/update-distribution.dto';

@Injectable()
export class DistributionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDistributionDto, actorId?: string) {
    const existing = await this.prisma.distribution.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`Distribucija sa kodom "${dto.code}" već postoji.`);
    }
    const created = await this.prisma.distribution.create({
      data: { name: dto.name, code: dto.code },
    });
    await this.prisma.activityLog.create({
      data: {
        userId: actorId,
        action: 'CREATE',
        entity: 'distribution',
        entityId: created.id,
        details: { name: created.name, code: created.code },
      },
    });
    return created;
  }

  async findAll(distributionId?: string) {
    const where = distributionId ? { id: distributionId } : undefined;
    return this.prisma.distribution.findMany({
      where,
      orderBy: { code: 'asc' },
      include: {
        _count: { select: { branches: true, users: true } },
      },
    });
  }

  async findOne(id: string) {
    const dist = await this.prisma.distribution.findUnique({
      where: { id },
      include: {
        branches: { orderBy: { code: 'asc' } },
        _count: { select: { users: true } },
      },
    });
    if (!dist) {
      throw new NotFoundException('Distribucija nije pronađena.');
    }
    return dist;
  }

  async update(id: string, dto: UpdateDistributionDto, actorId?: string) {
    await this.ensureExists(id);
    if (dto.code) {
      const existing = await this.prisma.distribution.findFirst({
        where: { code: dto.code, NOT: { id } },
      });
      if (existing) {
        throw new ConflictException(`Distribucija sa kodom "${dto.code}" već postoji.`);
      }
    }
    const updated = await this.prisma.distribution.update({
      where: { id },
      data: dto,
    });
    await this.prisma.activityLog.create({
      data: {
        userId: actorId,
        action: 'UPDATE',
        entity: 'distribution',
        entityId: id,
        details: { fields: Object.keys(dto) },
      },
    });
    return updated;
  }

  async remove(id: string, actorId?: string) {
    await this.ensureExists(id);
    const [branchCount, userCount, shipmentCount] = await Promise.all([
      this.prisma.branch.count({ where: { distributionId: id } }),
      this.prisma.user.count({ where: { distributionId: id } }),
      this.prisma.shipment.count({ where: { distributionId: id } }),
    ]);
    if (branchCount > 0) {
      throw new ConflictException(
        'Ne možete obrisati distribuciju koja ima podružnice. Prvo obrišite podružnice.',
      );
    }
    if (userCount > 0) {
      throw new ConflictException(
        'Ne možete obrisati distribuciju koja ima dodijeljene korisnike.',
      );
    }
    if (shipmentCount > 0) {
      throw new ConflictException(
        'Ne možete obrisati distribuciju koja ima povezane pošiljke.',
      );
    }
    const deleted = await this.prisma.distribution.delete({ where: { id } });
    await this.prisma.activityLog.create({
      data: {
        userId: actorId,
        action: 'DELETE',
        entity: 'distribution',
        entityId: id,
      },
    });
    return deleted;
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.distribution.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException('Distribucija nije pronađena.');
    }
  }
}
