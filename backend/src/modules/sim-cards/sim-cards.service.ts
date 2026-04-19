import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SimCardStatus } from '@prisma/client';
import { scopeWhere, ScopeContext } from '../../common/utils/scope-filter.util';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { AssignSimCardDto } from './dto/assign-sim-card.dto';
import { CreateSimCardDto } from './dto/create-sim-card.dto';
import { SimCardFilterDto } from './dto/sim-card-filter.dto';
import { UpdateSimCardDto } from './dto/update-sim-card.dto';

@Injectable()
export class SimCardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  async create(dto: CreateSimCardDto, actorId: string, ipAddress?: string, scope?: ScopeContext | null) {
    await this.ensureShipmentExists(dto.shipmentId, scope);

    try {
      const simCard = await this.prisma.simCard.create({
        data: {
          iccid: dto.iccid,
          ipAddress: dto.ipAddress,
          publicIpAddress: dto.publicIpAddress,
          phoneNumber: dto.phoneNumber,
          apn: dto.apn,
          shipmentId: dto.shipmentId,
          status: dto.status ?? SimCardStatus.AVAILABLE,
        },
        include: this.simCardInclude(),
      });

      await this.activityLogService.log({
        userId: actorId,
        action: 'CREATE',
        entity: 'sim_card',
        entityId: simCard.id,
        details: { iccid: simCard.iccid, status: simCard.status },
        ipAddress,
      });

      await this.createSimEvent(simCard.id, 'CREATED', actorId, {
        iccid: simCard.iccid,
        status: simCard.status,
      });

      return simCard;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('SIM card with this ICCID already exists');
      }

      throw error;
    }
  }

  async findAll(filter: SimCardFilterDto, scope?: ScopeContext | null): Promise<PaginatedResult<unknown>> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;

    const scopeClause = scopeWhere(scope, { viaShipment: true });
    const where: Prisma.SimCardWhereInput = {
      ...(scopeClause ? { AND: [scopeClause] } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.shipmentId ? { shipmentId: filter.shipmentId } : {}),
      ...(filter.assignedToId ? { assignedToId: filter.assignedToId } : {}),
      ...(filter.search
        ? {
            OR: [
              { iccid: { contains: filter.search } },
              { ipAddress: { contains: filter.search } },
              { publicIpAddress: { contains: filter.search } },
              { phoneNumber: { contains: filter.search } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.simCard.findMany({
        where,
        include: this.simCardInclude(),
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.simCard.count({ where }),
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
    const scopeClause = scopeWhere(scope, { viaShipment: true });
    const simCard = await this.prisma.simCard.findFirst({
      where: {
        id,
        ...(scopeClause ? { AND: [scopeClause] } : {}),
      },
      include: this.simCardInclude(),
    });

    if (!simCard) {
      throw new NotFoundException('SIM card not found');
    }

    return simCard;
  }

  async update(id: string, dto: UpdateSimCardDto, actorId: string, ipAddress?: string, scope?: ScopeContext | null) {
    await this.ensureSimCardExists(id, scope);

    if (dto.shipmentId) {
      await this.ensureShipmentExists(dto.shipmentId);
    }

    const updated = await this.prisma.simCard.update({
      where: { id },
      data: {
        iccid: dto.iccid,
        ipAddress: dto.ipAddress,
        publicIpAddress: dto.publicIpAddress,
        phoneNumber: dto.phoneNumber,
        apn: dto.apn,
        shipmentId: dto.shipmentId,
        status: dto.status,
      },
      include: this.simCardInclude(),
    });

    await this.activityLogService.log({
      userId: actorId,
      action: 'UPDATE',
      entity: 'sim_card',
      entityId: id,
      details: { fields: Object.keys(dto) },
      ipAddress,
    });

    if (dto.status) {
      await this.createSimEvent(id, `STATUS_${dto.status}`, actorId, {
        fields: Object.keys(dto),
      });
    }

    return updated;
  }

  async remove(id: string, actorId: string, ipAddress?: string, scope?: ScopeContext | null) {
    const scopeClause = scopeWhere(scope, { viaShipment: true });
    const simCard = await this.prisma.simCard.findFirst({
      where: {
        id,
        ...(scopeClause ? { AND: [scopeClause] } : {}),
      },
      select: { id: true, meter: { select: { id: true } } },
    });

    if (!simCard) {
      throw new NotFoundException('SIM card not found');
    }

    if (simCard.meter) {
      throw new BadRequestException('Ne možete obrisati SIM karticu koja je ugradjena u brojilo');
    }

    await this.prisma.simCard.delete({ where: { id } });

    await this.activityLogService.log({
      userId: actorId,
      action: 'DELETE',
      entity: 'sim_card',
      entityId: id,
      ipAddress,
    });

    return { deleted: true };
  }

  async scanByIccid(iccid: string, scope?: ScopeContext | null) {
    const simCard = await this.prisma.simCard.findUnique({
      where: { iccid },
      include: this.simCardInclude(),
    });

    if (!simCard) {
      throw new NotFoundException('SIM card not found for scanned ICCID');
    }

    const scopeClause = scopeWhere(scope, { viaShipment: true });
    if (scope && scope.role !== 'SYSTEM_ADMIN' && !scopeClause) {
      throw new BadRequestException(
        'Nemate dodijeljenu distribuciju ili podružnicu. Ne možete skenirati SIM kartice.',
      );
    }
    if (scopeClause) {
      const allowed = await this.prisma.simCard.findFirst({
        where: {
          iccid,
          AND: [scopeClause],
        },
        select: { id: true },
      });
      if (!allowed) {
        throw new BadRequestException(
          'Ova SIM kartica ne pripada vašoj distribuciji. Ne možete je skenirati niti zadužiti.',
        );
      }
    }

    return simCard;
  }

  async assign(
    id: string,
    dto: AssignSimCardDto,
    actorId: string,
    ipAddress?: string,
    scope?: ScopeContext | null,
  ) {
    await this.ensureSimCardExists(id, scope);
    const simCard = await this.prisma.simCard.findUnique({ where: { id } });
    if (!simCard) {
      throw new NotFoundException('SIM card not found');
    }

    if (simCard.status !== SimCardStatus.AVAILABLE && simCard.status !== SimCardStatus.ASSIGNED) {
      throw new BadRequestException('Only AVAILABLE or ASSIGNED SIM cards can be assigned');
    }

    await this.ensureUserExists(dto.userId);

    const updated = await this.prisma.simCard.update({
      where: { id },
      data: {
        assignedToId: dto.userId,
        assignedAt: new Date(),
        status: SimCardStatus.ASSIGNED,
      },
      include: this.simCardInclude(),
    });

    await this.activityLogService.log({
      userId: actorId,
      action: 'ASSIGN',
      entity: 'sim_card',
      entityId: id,
      details: { assignedToId: dto.userId },
      ipAddress,
    });

    await this.createSimEvent(id, 'ASSIGNED', actorId, {
      assignedToId: dto.userId,
    });

    return updated;
  }

  async claim(id: string, actorId: string, ipAddress?: string, scope?: ScopeContext | null) {
    const scopeClause = scopeWhere(scope, { viaShipment: true });
    if (scope && scope.role !== 'SYSTEM_ADMIN' && !scopeClause) {
      throw new BadRequestException(
        'Nemate dodijeljenu distribuciju ili podružnicu. Ne možete zadužiti SIM kartice.',
      );
    }
    const simCard = await this.prisma.simCard.findFirst({
      where: {
        id,
        ...(scopeClause ? { AND: [scopeClause] } : {}),
      },
    });
    if (!simCard) {
      const exists = await this.prisma.simCard.findUnique({
        where: { id },
        select: { id: true },
      });
      if (exists && scopeClause) {
        throw new BadRequestException(
          'Ova SIM kartica ne pripada vašoj distribuciji. Ne možete je zadužiti.',
        );
      }
      throw new NotFoundException('SIM card not found');
    }

    if (simCard.status === SimCardStatus.ASSIGNED && simCard.assignedToId === actorId) {
      return this.findOne(id);
    }

    if (simCard.status !== SimCardStatus.AVAILABLE) {
      throw new BadRequestException('Only AVAILABLE SIM cards can be claimed');
    }

    const claimed = await this.prisma.simCard.update({
      where: { id },
      data: {
        assignedToId: actorId,
        assignedAt: new Date(),
        status: SimCardStatus.ASSIGNED,
      },
      include: this.simCardInclude(),
    });

    await this.activityLogService.log({
      userId: actorId,
      action: 'CLAIM',
      entity: 'sim_card',
      entityId: id,
      details: { claimedById: actorId },
      ipAddress,
    });

    await this.createSimEvent(id, 'CLAIMED', actorId, {
      claimedById: actorId,
    });

    return claimed;
  }

  async unassign(id: string, actorId: string, ipAddress?: string, scope?: ScopeContext | null) {
    await this.ensureSimCardExists(id, scope);
    const simCard = await this.prisma.simCard.findUnique({ where: { id } });
    if (!simCard) {
      throw new NotFoundException('SIM card not found');
    }

    if (!simCard.assignedToId) {
      throw new BadRequestException('SIM card is not assigned');
    }

    if (simCard.status !== SimCardStatus.ASSIGNED) {
      throw new BadRequestException('Only ASSIGNED SIM cards can be unassigned');
    }

    const updated = await this.prisma.simCard.update({
      where: { id },
      data: {
        assignedToId: null,
        assignedAt: null,
        status: SimCardStatus.AVAILABLE,
      },
      include: this.simCardInclude(),
    });

    await this.activityLogService.log({
      userId: actorId,
      action: 'UNASSIGN',
      entity: 'sim_card',
      entityId: id,
      details: { previousAssignedToId: simCard.assignedToId },
      ipAddress,
    });

    await this.createSimEvent(id, 'UNASSIGNED', actorId, {
      previousAssignedToId: simCard.assignedToId,
    });

    return updated;
  }

  async available(pagination: SimCardFilterDto, scope?: ScopeContext | null): Promise<PaginatedResult<unknown>> {
    return this.findAll({ ...pagination, status: SimCardStatus.AVAILABLE }, scope);
  }

  async myAssigned(userId: string, pagination: SimCardFilterDto, scope?: ScopeContext | null): Promise<PaginatedResult<unknown>> {
    return this.findAll({ ...pagination, assignedToId: userId, status: SimCardStatus.ASSIGNED }, scope);
  }

  async stats(scope?: ScopeContext | null) {
    const scopeClause = scopeWhere(scope, { viaShipment: true });
    const grouped = await this.prisma.simCard.groupBy({
      by: ['status'],
      where: scopeClause ? { AND: [scopeClause] } : undefined,
      _count: {
        _all: true,
      },
    });

    const result = Object.values(SimCardStatus).reduce<Record<string, number>>(
      (acc, status) => {
        acc[status] = 0;
        return acc;
      },
      {},
    );

    for (const row of grouped) {
      result[row.status] = row._count._all;
    }

    return result;
  }

  async listEvents(id: string, scope?: ScopeContext | null) {
    await this.ensureSimCardExists(id, scope);
    const events = await this.prisma.simEvent.findMany({
      where: { simCardId: id },
      orderBy: { createdAt: 'desc' },
    });
    const userIds = [...new Set(events.map((e) => e.userId).filter((uid): uid is string => Boolean(uid)))];
    const users =
      userIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, firstName: true, lastName: true, email: true },
          })
        : [];
    const userById = new Map(users.map((u) => [u.id, u] as const));
    return events.map((e) => ({
      id: e.id,
      type: e.type,
      createdAt: e.createdAt,
      metadata: e.metadata,
      user: e.userId ? userById.get(e.userId) ?? null : null,
    }));
  }

  private async ensureSimCardExists(id: string, scope?: ScopeContext | null): Promise<void> {
    const scopeClause = scopeWhere(scope, { viaShipment: true });
    const exists = await this.prisma.simCard.findFirst({
      where: {
        id,
        ...(scopeClause ? { AND: [scopeClause] } : {}),
      },
      select: { id: true },
    });

    if (!exists) {
      throw new NotFoundException('SIM card not found');
    }
  }

  private async ensureShipmentExists(id: string, scope?: ScopeContext | null): Promise<void> {
    const scopeClause = scopeWhere(scope, { distributionIdField: 'distributionId' });
    const exists = await this.prisma.shipment.findFirst({
      where: {
        id,
        ...(scopeClause ? { AND: [scopeClause] } : {}),
      },
      select: { id: true },
    });

    if (!exists) {
      throw new NotFoundException('Shipment not found');
    }
  }

  private async ensureUserExists(id: string): Promise<void> {
    const exists = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!exists) {
      throw new NotFoundException('User not found');
    }
  }

  private simCardInclude() {
    return {
      assignedTo: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          status: true,
        },
      },
      shipment: {
        select: {
          id: true,
          name: true,
          provider: true,
          receivedDate: true,
        },
      },
    } as const;
  }

  private async createSimEvent(
    simCardId: string,
    type: string,
    userId?: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    await this.prisma.simEvent.create({
      data: {
        simCardId,
        type,
        userId,
        metadata,
      },
    });
  }
}
