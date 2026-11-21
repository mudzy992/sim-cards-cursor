import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SimCardStatus } from '@prisma/client';
import { scopeWhere, ScopeContext } from '../../common/utils/scope-filter.util';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { ErrorCodes } from '../../common/constants/error-codes';
import { AssignSimCardDto } from './dto/assign-sim-card.dto';
import { CreateSimCardDto } from './dto/create-sim-card.dto';
import { SimCardFilterDto } from './dto/sim-card-filter.dto';
import { UpdateSimCardDto } from './dto/update-sim-card.dto';
import { normalizeIccid, normalizePhoneNumber } from '../shipments/import/excel-import.service';

@Injectable()
export class SimCardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  async moderatedInstalled(
    filter: SimCardFilterDto,
    scope?: ScopeContext | null,
  ): Promise<
    PaginatedResult<
      Prisma.SimCardGetPayload<{
        include: ReturnType<SimCardsService['moderatedInstalledInclude']>;
      }> & { installedAt: Date | null }
    >
  > {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;

    const branchIds = this.getModeratedBranchIds(scope);
    if (scope?.role === 'DIST_ADMIN' && !scope.distributionId) {
      return { items: [], page, limit, total: 0, totalPages: 1 };
    }
    if (scope?.role === 'USER' && !branchIds) {
      return { items: [], page, limit, total: 0, totalPages: 1 };
    }

    const where: Prisma.SimCardWhereInput = {
      status: SimCardStatus.INSTALLED,
      meter: {
        is: {
          ...(branchIds ? { branchId: { in: branchIds } } : {}),
          ...(scope?.role === 'DIST_ADMIN' && scope.distributionId
            ? { branch: { distributionId: scope.distributionId } }
            : {}),
        },
      },
      ...(filter.search
        ? {
            OR: [
              { iccid: { contains: filter.search, mode: 'insensitive' } },
              { ipAddress: { contains: filter.search, mode: 'insensitive' } },
              { publicIpAddress: { contains: filter.search, mode: 'insensitive' } },
              { phoneNumber: { contains: filter.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.simCard.findMany({
        where,
        include: this.moderatedInstalledInclude(),
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.simCard.count({ where }),
    ]);

    const withInstalledAt = items.map((i) => ({
      ...i,
      installedAt: i.installationRecords?.[0]?.createdAt ?? null,
    }));

    return {
      items: withInstalledAt,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async create(
    dto: CreateSimCardDto,
    actorId: string,
    ipAddress?: string,
    scope?: ScopeContext | null,
  ) {
    await this.ensureShipmentExists(dto.shipmentId, scope);

    const simIccid = normalizeIccid(dto.iccid.trim());
    const simIpAddress = dto.ipAddress.trim();
    const simPublicIpAddress = dto.publicIpAddress?.trim() || undefined;
    const simPhoneNumber = dto.phoneNumber?.trim() || undefined;

    await this.assertUniqueSimFields({
      iccid: simIccid,
      ipAddress: simIpAddress,
      publicIpAddress: simPublicIpAddress,
      phoneNumber: simPhoneNumber,
    });

    try {
      const simCard = await this.prisma.$transaction(async (tx) => {
        const created = await tx.simCard.create({
          data: {
            iccid: simIccid,
            ipAddress: simIpAddress,
            publicIpAddress: simPublicIpAddress,
            phoneNumber: simPhoneNumber,
            apn: dto.apn?.trim() || undefined,
            shipmentId: dto.shipmentId,
            status: dto.status ?? SimCardStatus.AVAILABLE,
          },
          include: this.simCardInclude(),
        });

        const totalCards = await tx.simCard.count({
          where: { shipmentId: dto.shipmentId },
        });
        await tx.shipment.update({
          where: { id: dto.shipmentId },
          data: { totalCards },
        });

        return created;
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
        throw new ConflictException({
          message: 'SIM card with this ICCID already exists',
          code: ErrorCodes.SIM_DUPLICATE_ICCID,
        });
      }

      throw error;
    }
  }

  async findAll(
    filter: SimCardFilterDto,
    scope?: ScopeContext | null,
  ): Promise<PaginatedResult<unknown>> {
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
              { iccid: { contains: filter.search, mode: 'insensitive' } },
              { ipAddress: { contains: filter.search, mode: 'insensitive' } },
              { publicIpAddress: { contains: filter.search, mode: 'insensitive' } },
              { phoneNumber: { contains: filter.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.simCard.findMany({
        where,
        include: this.simCardInclude(),
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
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

  async findOne(id: string, scope?: ScopeContext | null, actorUserId?: string) {
    const where = this.buildSingleSimWhere(id, scope, actorUserId);
    const simCard = await this.prisma.simCard.findFirst({
      where,
      include: this.simCardInclude(),
    });

    if (!simCard) {
      throw new NotFoundException({
        message: 'SIM card not found',
        code: ErrorCodes.SIM_NOT_FOUND,
      });
    }

    return simCard;
  }

  async update(
    id: string,
    dto: UpdateSimCardDto,
    actorId: string,
    ipAddress?: string,
    scope?: ScopeContext | null,
  ) {
    const scopeClause = scopeWhere(scope, { viaShipment: true });
    const existing = await this.prisma.simCard.findFirst({
      where: {
        id,
        ...(scopeClause ? { AND: [scopeClause] } : {}),
      },
      select: {
        id: true,
        shipmentId: true,
        status: true,
        meter: { select: { id: true } },
      },
    });

    if (!existing) {
      throw new NotFoundException({
        message: 'SIM card not found',
        code: ErrorCodes.SIM_NOT_FOUND,
      });
    }

    if (existing.meter && dto.status !== undefined && dto.status !== SimCardStatus.INSTALLED) {
      throw new BadRequestException(
        'SIM kartica je ugrađena u brojilo — promjena statusa je moguća samo kroz proces demontaže.',
      );
    }

    if (dto.shipmentId) {
      await this.ensureShipmentExists(dto.shipmentId, scope);
    }

    const nextIccid = dto.iccid !== undefined ? normalizeIccid(dto.iccid.trim()) : undefined;
    const nextIpAddress = dto.ipAddress !== undefined ? dto.ipAddress.trim() : undefined;
    const nextPublicIpAddress =
      dto.publicIpAddress !== undefined ? dto.publicIpAddress.trim() || null : undefined;
    const nextPhoneNumber =
      dto.phoneNumber !== undefined ? dto.phoneNumber.trim() || null : undefined;
    const nextApn = dto.apn !== undefined ? dto.apn.trim() || null : undefined;

    await this.assertUniqueSimFields(
      {
        iccid: nextIccid,
        ipAddress: nextIpAddress,
        publicIpAddress: nextPublicIpAddress ?? undefined,
        phoneNumber: nextPhoneNumber ?? undefined,
      },
      id,
    );

    const shipmentChanged = dto.shipmentId !== undefined && dto.shipmentId !== existing.shipmentId;

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.simCard.update({
        where: { id },
        data: {
          iccid: nextIccid,
          ipAddress: nextIpAddress,
          publicIpAddress: nextPublicIpAddress,
          phoneNumber: nextPhoneNumber,
          apn: nextApn,
          shipmentId: dto.shipmentId,
          status: dto.status,
        },
        include: this.simCardInclude(),
      });

      if (shipmentChanged && dto.shipmentId) {
        const [oldTotal, newTotal] = await Promise.all([
          tx.simCard.count({ where: { shipmentId: existing.shipmentId } }),
          tx.simCard.count({ where: { shipmentId: dto.shipmentId } }),
        ]);
        await tx.shipment.update({
          where: { id: existing.shipmentId },
          data: { totalCards: oldTotal },
        });
        await tx.shipment.update({
          where: { id: dto.shipmentId },
          data: { totalCards: newTotal },
        });
      }

      return saved;
    });

    await this.activityLogService.log({
      userId: actorId,
      action: 'UPDATE',
      entity: 'sim_card',
      entityId: id,
      details: { fields: Object.keys(dto) },
      ipAddress,
    });

    if (dto.status && dto.status !== existing.status) {
      await this.createSimEvent(id, `STATUS_${dto.status}`, actorId, {
        fields: Object.keys(dto),
      });
    }

    return updated;
  }

  async remove(
    id: string,
    actorId: string,
    ipAddress?: string,
    scope?: ScopeContext | null,
  ) {
    const scopeClause = scopeWhere(scope, { viaShipment: true });
    const simCard = await this.prisma.simCard.findFirst({
      where: {
        id,
        ...(scopeClause ? { AND: [scopeClause] } : {}),
      },
      select: { id: true, shipmentId: true, meter: { select: { id: true } } },
    });

    if (!simCard) {
      throw new NotFoundException({
        message: 'SIM card not found',
        code: ErrorCodes.SIM_NOT_FOUND,
      });
    }

    if (simCard.meter) {
      throw new BadRequestException({
        message: 'Ne možete obrisati SIM karticu koja je ugradjena u brojilo',
        code: ErrorCodes.SIM_DELETE_INSTALLED_FORBIDDEN,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.simCard.delete({ where: { id } });
      const totalCards = await tx.simCard.count({
        where: { shipmentId: simCard.shipmentId },
      });
      await tx.shipment.update({
        where: { id: simCard.shipmentId },
        data: { totalCards },
      });
    });

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
    const normalized = normalizeIccid(iccid.trim());
    const simCard = await this.prisma.simCard.findUnique({
      where: { iccid: normalized },
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
          iccid: normalized,
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

  async scanBatch(iccids: string[], scope?: ScopeContext | null) {
    const normalizedList = Array.from(
      new Set(iccids.map((v) => normalizeIccid(v.trim())).filter(Boolean)),
    ).slice(0, 100);

    if (normalizedList.length === 0) {
      return { items: [], notFoundIccids: [] };
    }

    const scopeClause = scopeWhere(scope, { viaShipment: true });
    if (scope && scope.role !== 'SYSTEM_ADMIN' && !scopeClause) {
      throw new BadRequestException(
        'Nemate dodijeljenu distribuciju ili podružnicu. Ne možete skenirati SIM kartice.',
      );
    }

    const items = await this.prisma.simCard.findMany({
      where: {
        iccid: { in: normalizedList },
        ...(scopeClause ? { AND: [scopeClause] } : {}),
      },
      include: this.simCardInclude(),
    });

    const foundSet = new Set(items.map((item) => item.iccid));
    const notFoundIccids = normalizedList.filter((iccid) => !foundSet.has(iccid));

    return { items, notFoundIccids };
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

    await this.ensureUserExists(dto.userId, scope);

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

  async bulkAssign(
    simCardIds: string[],
    userId: string,
    actorId: string,
    ipAddress?: string,
    scope?: ScopeContext | null,
  ) {
    const uniqueIds = Array.from(new Set(simCardIds));
    await this.ensureUserExists(userId, scope);

    const scopeClause = scopeWhere(scope, { viaShipment: true });
    const candidates = await this.prisma.simCard.findMany({
      where: {
        id: { in: uniqueIds },
        ...(scopeClause ? { AND: [scopeClause] } : {}),
      },
      select: { id: true, status: true },
    });

    const assignableIds = candidates
      .filter((c) => c.status === SimCardStatus.AVAILABLE)
      .map((c) => c.id);

    if (assignableIds.length === 0) {
      throw new BadRequestException(
        'Nijedna odabrana SIM kartica nije u statusu AVAILABLE ili izvan je vašeg opsega.',
      );
    }

    const assignedAt = new Date();
    const assignedCount = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.simCard.updateMany({
        where: {
          id: { in: assignableIds },
          status: SimCardStatus.AVAILABLE,
        },
        data: {
          assignedToId: userId,
          assignedAt,
          status: SimCardStatus.ASSIGNED,
        },
      });

      if (updated.count > 0) {
        await tx.simEvent.createMany({
          data: assignableIds.map((simCardId) => ({
            simCardId,
            type: 'ASSIGNED',
            userId: actorId,
            metadata: { assignedToId: userId, bulk: true },
          })),
        });
      }

      return updated.count;
    });

    await this.activityLogService.log({
      userId: actorId,
      action: 'ASSIGN',
      entity: 'sim_card',
      details: {
        assignedToId: userId,
        requestedCount: uniqueIds.length,
        assignedCount,
        bulk: true,
      },
      ipAddress,
    });

    return {
      assignedCount,
      requestedCount: uniqueIds.length,
      skippedCount: uniqueIds.length - assignedCount,
    };
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
      throw new NotFoundException({
        message: 'SIM card not found',
        code: ErrorCodes.SIM_NOT_FOUND,
      });
    }

    if (simCard.status === SimCardStatus.ASSIGNED && simCard.assignedToId === actorId) {
      return this.findOne(id, scope, actorId);
    }

    if (simCard.status !== SimCardStatus.AVAILABLE) {
      throw new BadRequestException({
        message: 'Only AVAILABLE SIM cards can be claimed',
        code: ErrorCodes.SIM_ALREADY_CLAIMED_OR_UNAVAILABLE,
      });
    }

    const claimUpdate = await this.prisma.simCard.updateMany({
      where: {
        id,
        status: SimCardStatus.AVAILABLE,
      },
      data: {
        assignedToId: actorId,
        assignedAt: new Date(),
        status: SimCardStatus.ASSIGNED,
      },
    });

    if (claimUpdate.count === 0) {
      const latest = await this.prisma.simCard.findUnique({
        where: { id },
        select: { status: true, assignedToId: true },
      });
      if (latest?.status === SimCardStatus.ASSIGNED && latest.assignedToId === actorId) {
        return this.findOne(id, scope, actorId);
      }
      throw new BadRequestException({
        message: 'Only AVAILABLE SIM cards can be claimed',
        code: ErrorCodes.SIM_ALREADY_CLAIMED_OR_UNAVAILABLE,
      });
    }

    const claimed = await this.findOne(id, scope, actorId);

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
      throw new NotFoundException({
        message: 'SIM card not found',
        code: ErrorCodes.SIM_NOT_FOUND,
      });
    }

    if (!simCard.assignedToId) {
      throw new BadRequestException({
        message: 'SIM card is not assigned',
        code: ErrorCodes.SIM_NOT_ASSIGNED,
      });
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

  async returnToStock(
    id: string,
    actorId: string,
    ipAddress?: string,
    scope?: ScopeContext | null,
  ) {
    const scopeClause = scopeWhere(scope, { viaShipment: true });
    const simCard = await this.prisma.simCard.findFirst({
      where: {
        id,
        ...(scopeClause ? { AND: [scopeClause] } : {}),
      },
      select: {
        id: true,
        status: true,
        meter: { select: { id: true } },
      },
    });

    if (!simCard) {
      throw new NotFoundException({
        message: 'SIM card not found',
        code: ErrorCodes.SIM_NOT_FOUND,
      });
    }

    if (simCard.meter) {
      throw new BadRequestException(
        'SIM kartica je i dalje povezana sa brojilom i ne može se vratiti u zalihe.',
      );
    }

    if (
      simCard.status !== SimCardStatus.DEMOUNTED &&
      simCard.status !== SimCardStatus.RETURNED
    ) {
      throw new BadRequestException(
        'Samo DEMOUNTED ili RETURNED SIM kartice mogu biti vraćene u dostupne zalihe.',
      );
    }

    const updated = await this.prisma.simCard.update({
      where: { id },
      data: {
        status: SimCardStatus.AVAILABLE,
        assignedToId: null,
        assignedAt: null,
      },
      include: this.simCardInclude(),
    });

    await this.activityLogService.log({
      userId: actorId,
      action: 'STATUS_CHANGE',
      entity: 'sim_card',
      entityId: id,
      details: { previousStatus: simCard.status, nextStatus: SimCardStatus.AVAILABLE },
      ipAddress,
    });

    await this.createSimEvent(id, 'RETURNED_TO_STOCK', actorId, {
      previousStatus: simCard.status,
    });

    return updated;
  }

  async available(
    pagination: SimCardFilterDto,
    scope?: ScopeContext | null,
  ): Promise<PaginatedResult<unknown>> {
    return this.findAll({ ...pagination, status: SimCardStatus.AVAILABLE }, scope);
  }

  async myAssigned(
    userId: string,
    pagination: SimCardFilterDto,
    scope?: ScopeContext | null,
  ): Promise<PaginatedResult<unknown>> {
    return this.findAll(
      { ...pagination, assignedToId: userId, status: SimCardStatus.ASSIGNED },
      scope,
    );
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

  async listEvents(id: string, scope?: ScopeContext | null, actorUserId?: string) {
    const where = this.buildSingleSimWhere(id, scope, actorUserId);
    const exists = await this.prisma.simCard.findFirst({
      where,
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException({
        message: 'SIM card not found',
        code: ErrorCodes.SIM_NOT_FOUND,
      });
    }

    const events = await this.prisma.simEvent.findMany({
      where: { simCardId: id },
      orderBy: { createdAt: 'desc' },
    });
    const userIds = [
      ...new Set(events.map((e) => e.userId).filter((uid): uid is string => Boolean(uid))),
    ];
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

  private buildSingleSimWhere(
    id: string,
    scope?: ScopeContext | null,
    actorUserId?: string,
  ): Prisma.SimCardWhereInput {
    if (!scope) {
      return { id, id_fail: undefined } as unknown as Prisma.SimCardWhereInput;
    }
    if (scope.role === 'USER') {
      const moderatedBranches = this.getModeratedBranchIds(scope);
      if (moderatedBranches && moderatedBranches.length > 0) {
        return {
          id,
          OR: [
            { meter: { is: { branchId: { in: moderatedBranches } } } },
            ...(actorUserId ? [{ assignedToId: actorUserId }] : []),
          ],
        };
      }
      if (actorUserId) {
        return { id, assignedToId: actorUserId };
      }
      return { id: { in: [] } };
    }
    const scopeClause = scopeWhere(scope, { viaShipment: true });
    return {
      id,
      ...(scopeClause ? { AND: [scopeClause] } : {}),
    };
  }

  private async assertUniqueSimFields(
    fields: {
      iccid?: string;
      ipAddress?: string;
      publicIpAddress?: string;
      phoneNumber?: string;
    },
    excludeId?: string,
  ): Promise<void> {
    const normalizedPhone = fields.phoneNumber
      ? normalizePhoneNumber(fields.phoneNumber)
      : undefined;

    const duplicateChecks: Prisma.SimCardWhereInput[] = [
      ...(fields.iccid ? [{ iccid: fields.iccid }] : []),
      ...(fields.ipAddress ? [{ ipAddress: fields.ipAddress }] : []),
      ...(fields.publicIpAddress ? [{ publicIpAddress: fields.publicIpAddress }] : []),
      ...(fields.phoneNumber
        ? [
            {
              phoneNumber: {
                in:
                  normalizedPhone && normalizedPhone !== fields.phoneNumber
                    ? [fields.phoneNumber, normalizedPhone]
                    : [fields.phoneNumber],
              },
            },
          ]
        : []),
    ];

    if (duplicateChecks.length === 0) return;

    const existingDup = await this.prisma.simCard.findFirst({
      where: {
        ...(excludeId ? { id: { not: excludeId } } : {}),
        OR: duplicateChecks,
      },
      select: { iccid: true, ipAddress: true, publicIpAddress: true, phoneNumber: true },
    });

    if (!existingDup) return;

    if (fields.iccid && existingDup.iccid === fields.iccid) {
      throw new ConflictException({
        message: 'SIM kartica sa ovim ICCID-om već postoji u bazi.',
        code: ErrorCodes.SIM_DUPLICATE_ICCID,
      });
    }
    if (fields.ipAddress && existingDup.ipAddress === fields.ipAddress) {
      throw new ConflictException({
        message: 'SIM kartica sa ovom internom IP adresom već postoji u bazi.',
        code: ErrorCodes.SIM_DUPLICATE_IP,
      });
    }
    if (fields.publicIpAddress && existingDup.publicIpAddress === fields.publicIpAddress) {
      throw new ConflictException({
        message: 'SIM kartica sa ovom javnom IP adresom već postoji u bazi.',
        code: ErrorCodes.SIM_DUPLICATE_PUBLIC_IP,
      });
    }
    if (
      normalizedPhone &&
      existingDup.phoneNumber &&
      normalizePhoneNumber(existingDup.phoneNumber) === normalizedPhone
    ) {
      throw new ConflictException({
        message: 'SIM kartica sa ovim brojem telefona već postoji u bazi.',
        code: ErrorCodes.SIM_DUPLICATE_PHONE,
      });
    }
    throw new ConflictException({
      message: 'SIM kartica sa istim podacima već postoji u bazi.',
      code: ErrorCodes.CONFLICT,
    });
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

  private async ensureUserExists(id: string, scope?: ScopeContext | null): Promise<void> {
    const scopeClause = scopeWhere(scope, { userScope: true });
    const exists = await this.prisma.user.findFirst({
      where: {
        id,
        ...(scopeClause ? { AND: [scopeClause] } : {}),
      },
      select: { id: true },
    });

    if (!exists) {
      throw new ForbiddenException('User not found or outside your distribution scope');
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
      meter: {
        select: {
          id: true,
          serialNumber: true,
          status: true,
          branch: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      },
    } as const;
  }

  private moderatedInstalledInclude() {
    return {
      ...this.simCardInclude(),
      installationRecords: {
        select: {
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    } as const;
  }

  private getModeratedBranchIds(scope?: ScopeContext | null): string[] | null {
    if (!scope) return null;
    if (scope.role !== 'USER') return null;
    const moderated = scope.branchModeratorBranchIds ?? [];
    const combined = scope.branchId ? [scope.branchId, ...moderated] : moderated;
    const unique = [...new Set(combined)].filter((id) => Boolean(id));
    return unique.length > 0 ? unique : null;
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
