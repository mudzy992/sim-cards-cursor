import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogFilterDto } from './dto/activity-log-filter.dto';

type CreateActivityLogInput = {
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: Prisma.InputJsonValue;
  ipAddress?: string;
};

@Injectable()
export class ActivityLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: CreateActivityLogInput): Promise<void> {
    await this.prisma.activityLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        details: input.details,
        ipAddress: input.ipAddress,
      },
    });
  }

  async findAll(filter: ActivityLogFilterDto): Promise<PaginatedResult<unknown>> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;

    const where: Prisma.ActivityLogWhereInput = {
      ...(filter.action ? { action: { contains: filter.action } } : {}),
      ...(filter.entity ? { entity: { contains: filter.entity } } : {}),
      ...(filter.userId ? { userId: filter.userId } : {}),
      ...(filter.from || filter.to
        ? {
            createdAt: {
              ...(filter.from ? { gte: new Date(filter.from) } : {}),
              ...(filter.to ? { lte: new Date(filter.to) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.activityLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findForEntity(
    entity: string,
    entityId: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResult<unknown>> {
    const where: Prisma.ActivityLogWhereInput = {
      entity,
      entityId,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.activityLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }
}
