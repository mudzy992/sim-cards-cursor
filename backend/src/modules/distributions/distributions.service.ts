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

  async create(dto: CreateDistributionDto) {
    const existing = await this.prisma.distribution.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`Distribucija sa kodom "${dto.code}" već postoji.`);
    }
    return this.prisma.distribution.create({
      data: { name: dto.name, code: dto.code },
    });
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

  async update(id: string, dto: UpdateDistributionDto) {
    await this.ensureExists(id);
    if (dto.code) {
      const existing = await this.prisma.distribution.findFirst({
        where: { code: dto.code, NOT: { id } },
      });
      if (existing) {
        throw new ConflictException(`Distribucija sa kodom "${dto.code}" već postoji.`);
      }
    }
    return this.prisma.distribution.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    const count = await this.prisma.branch.count({ where: { distributionId: id } });
    if (count > 0) {
      throw new ConflictException(
        'Ne možete obrisati distribuciju koja ima podružnice. Prvo obrišite podružnice.',
      );
    }
    return this.prisma.distribution.delete({ where: { id } });
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
