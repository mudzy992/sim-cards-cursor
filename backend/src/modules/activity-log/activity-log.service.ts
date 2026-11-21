import { Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { ScopeContext } from '../../common/utils/scope-filter.util';
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

  private resolveTenantFilter(
    scope?: ScopeContext | null,
  ): { allowed: false } | { allowed: true; where: Prisma.ActivityLogWhereInput } {
    if (!scope || scope.role === UserRole.SYSTEM_ADMIN) {
      return { allowed: true, where: {} };
    }

    if (scope.role === UserRole.DIST_ADMIN && scope.distributionId) {
      return {
        allowed: true,
        where: {
          user: {
            OR: [
              { distributionId: scope.distributionId },
              { branch: { distributionId: scope.distributionId } },
            ],
          },
        },
      };
    }

    return { allowed: false };
  }

  async findAll(
    filter: ActivityLogFilterDto,
    scope?: ScopeContext | null,
  ): Promise<PaginatedResult<unknown>> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;

    const tenant = this.resolveTenantFilter(scope);
    if (!tenant.allowed) {
      return { items: [], page, limit, total: 0, totalPages: 1 };
    }

    const where: Prisma.ActivityLogWhereInput = {
      ...tenant.where,
      ...(filter.action
        ? { action: { contains: filter.action, mode: 'insensitive' } }
        : {}),
      ...(filter.entity
        ? { entity: { contains: filter.entity, mode: 'insensitive' } }
        : {}),
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
    scope?: ScopeContext | null,
  ): Promise<PaginatedResult<unknown>> {
    const tenant = this.resolveTenantFilter(scope);
    if (!tenant.allowed) {
      return { items: [], page, limit, total: 0, totalPages: 1 };
    }

    const where: Prisma.ActivityLogWhereInput = {
      ...tenant.where,
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
