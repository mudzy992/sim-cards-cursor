import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBranchDto, actorId?: string) {
    await this.ensureDistributionExists(dto.distributionId);
    const existing = await this.prisma.branch.findUnique({
      where: {
        distributionId_code: {
          distributionId: dto.distributionId,
          code: dto.code,
        },
      },
    });
    if (existing) {
      throw new ConflictException(
        `Podružnica sa kodom "${dto.code}" već postoji u ovoj distribuciji.`,
      );
    }
    const created = await this.prisma.branch.create({
      data: {
        distributionId: dto.distributionId,
        name: dto.name,
        code: dto.code,
      },
      include: { distribution: true },
    });
    await this.prisma.activityLog.create({
      data: {
        userId: actorId,
        action: 'CREATE',
        entity: 'branch',
        entityId: created.id,
        details: {
          distributionId: created.distributionId,
          name: created.name,
          code: created.code,
        },
      },
    });
    return created;
  }

  async findAll(distributionId?: string) {
    const where = distributionId ? { distributionId } : {};
    return this.prisma.branch.findMany({
      where,
      orderBy: [{ distribution: { code: 'asc' } }, { code: 'asc' }],
      include: {
        distribution: { select: { id: true, name: true, code: true } },
        _count: { select: { meters: true, users: true } },
      },
    });
  }

  async findOne(id: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      include: {
        distribution: true,
        _count: { select: { meters: true, users: true } },
      },
    });
    if (!branch) {
      throw new NotFoundException('Podružnica nije pronađena.');
    }
    return branch;
  }

  async update(id: string, dto: UpdateBranchDto, actorId?: string) {
    const branch = await this.ensureExists(id);
    if (dto.code) {
      const existing = await this.prisma.branch.findFirst({
        where: {
          distributionId: branch.distributionId,
          code: dto.code,
          NOT: { id },
        },
      });
      if (existing) {
        throw new ConflictException(
          `Podružnica sa kodom "${dto.code}" već postoji u ovoj distribuciji.`,
        );
      }
    }
    const updated = await this.prisma.branch.update({
      where: { id },
      data: dto,
      include: { distribution: true },
    });
    await this.prisma.activityLog.create({
      data: {
        userId: actorId,
        action: 'UPDATE',
        entity: 'branch',
        entityId: id,
        details: { fields: Object.keys(dto) },
      },
    });
    return updated;
  }

  async remove(id: string, actorId?: string) {
    await this.ensureExists(id);
    const [meterCount, userCount, moderatorCount, recipientCount] =
      await Promise.all([
        this.prisma.meter.count({ where: { branchId: id } }),
        this.prisma.user.count({ where: { branchId: id } }),
        this.prisma.branchModerator.count({ where: { branchId: id } }),
        this.prisma.branchEmailRecipient.count({ where: { branchId: id } }),
      ]);
    if (meterCount > 0) {
      throw new ConflictException(
        'Ne možete obrisati podružnicu koja ima brojila. Prvo premjestite ili uklonite brojila.',
      );
    }
    if (userCount > 0 || moderatorCount > 0 || recipientCount > 0) {
      throw new ConflictException(
        'Ne možete obrisati podružnicu koja ima dodijeljene korisnike, moderatore ili primaoce emaila.',
      );
    }
    const deleted = await this.prisma.branch.delete({ where: { id } });
    await this.prisma.activityLog.create({
      data: {
        userId: actorId,
        action: 'DELETE',
        entity: 'branch',
        entityId: id,
      },
    });
    return deleted;
  }

  private async ensureExists(id: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      select: { id: true, distributionId: true },
    });
    if (!branch) {
      throw new NotFoundException('Podružnica nije pronađena.');
    }
    return branch;
  }

  private async ensureDistributionExists(distributionId: string) {
    const exists = await this.prisma.distribution.findUnique({
      where: { id: distributionId },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException('Distribucija nije pronađena.');
    }
  }
}
