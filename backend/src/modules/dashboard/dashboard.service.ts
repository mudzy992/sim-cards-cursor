import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  scopeWhere,
  simCardScopeWhere,
  ScopeContext,
} from 'src/common/utils/scope-filter.util';

const DAY_MS = 86_400_000;
const CHART_BATCH_SIZE = 5000;
const CHART_MAX_ROWS = 50_000;

export interface DashboardStats {
  installationRecords: {
    total: number;
    byStatus: Record<string, number>;
  };
  simCards: {
    total: number;
    available: number;
    assigned: number;
    installed: number;
  };
  meters: number;
}

export interface RecentRecord {
  id: string;
  recordNumber: string;
  status: string;
  createdAt: Date;
  meter?: { serialNumber: string };
  installedBy?: { firstName: string; lastName: string };
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(scope?: ScopeContext | null): Promise<DashboardStats> {
    const irScope = scopeWhere(scope, { viaMeter: true });
    const simScope = simCardScopeWhere<Prisma.SimCardWhereInput>(scope);
    const meterScope = scopeWhere(scope, { branchIdField: 'branchId' });

    const irWhere = irScope ? { AND: [irScope] } : {};
    const simWhere = simScope ? { AND: [simScope] } : {};
    const meterWhere = meterScope ? { AND: [meterScope] } : {};

    const [irByStatus, irTotal, simCounts, meterCount] = await Promise.all([
      this.prisma.installationRecord.groupBy({
        by: ['status'],
        where: irWhere,
        _count: { id: true },
      }),
      this.prisma.installationRecord.count({ where: irWhere }),
      this.prisma.simCard.groupBy({
        by: ['status'],
        where: simWhere,
        _count: { id: true },
      }),
      this.prisma.meter.count({ where: meterWhere }),
    ]);

    const byStatus: Record<string, number> = {};
    irByStatus.forEach((r) => {
      byStatus[r.status] = r._count.id;
    });

    let simTotal = 0;
    let simAvailable = 0;
    let simAssigned = 0;
    let simInstalled = 0;
    simCounts.forEach((r) => {
      simTotal += r._count.id;
      if (r.status === 'AVAILABLE') simAvailable = r._count.id;
      if (r.status === 'ASSIGNED') simAssigned = r._count.id;
      if (r.status === 'INSTALLED') simInstalled = r._count.id;
    });

    return {
      installationRecords: {
        total: irTotal,
        byStatus,
      },
      simCards: {
        total: simTotal,
        available: simAvailable,
        assigned: simAssigned,
        installed: simInstalled,
      },
      meters: meterCount,
    };
  }

  async getRecentRecords(
    limit = 10,
    scope?: ScopeContext | null,
  ): Promise<RecentRecord[]> {
    const safeLimit = Math.min(
      50,
      Math.max(1, Number.isFinite(limit) ? Math.trunc(limit) : 10),
    );
    const irScope = scopeWhere(scope, { viaMeter: true });
    const where = irScope ? { AND: [irScope] } : {};

    const records = await this.prisma.installationRecord.findMany({
      where,
      take: safeLimit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        recordNumber: true,
        status: true,
        createdAt: true,
        meter: { select: { serialNumber: true } },
        installedBy: { select: { firstName: true, lastName: true } },
      },
    });

    return records.map((r) => ({
      id: r.id,
      recordNumber: r.recordNumber,
      status: r.status,
      createdAt: r.createdAt,
      meter: r.meter,
      installedBy: r.installedBy,
    }));
  }

  async getRecordsChart(
    days = 30,
    scope?: ScopeContext | null,
  ): Promise<{ date: string; count: number }[]> {
    const safeDays = Math.min(
      365,
      Math.max(1, Number.isFinite(days) ? Math.trunc(days) : 30),
    );
    const irScope = scopeWhere(scope, { viaMeter: true });
    const where = irScope ? { AND: [irScope] } : {};

    const now = new Date();
    const endUtcDayMs = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    );
    const startUtcMs = endUtcDayMs - safeDays * DAY_MS;
    const startDate = new Date(startUtcMs);

    const byDate = new Map<string, number>();
    for (let i = 0; i <= safeDays; i++) {
      const key = new Date(startUtcMs + i * DAY_MS).toISOString().slice(0, 10);
      byDate.set(key, 0);
    }

    let cursorId: string | undefined;
    let processed = 0;
    while (processed < CHART_MAX_ROWS) {
      const batch = await this.prisma.installationRecord.findMany({
        where: {
          ...where,
          createdAt: { gte: startDate },
        },
        select: { id: true, createdAt: true },
        orderBy: { id: 'asc' },
        take: CHART_BATCH_SIZE,
        ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      });

      for (const r of batch) {
        const key = r.createdAt.toISOString().slice(0, 10);
        if (byDate.has(key)) {
          byDate.set(key, (byDate.get(key) ?? 0) + 1);
        }
      }

      processed += batch.length;
      if (batch.length < CHART_BATCH_SIZE || !batch[batch.length - 1]?.id) {
        break;
      }
      cursorId = batch[batch.length - 1].id;
    }

    return Array.from(byDate.entries()).map(([date, count]) => ({
      date,
      count,
    }));
  }
}
