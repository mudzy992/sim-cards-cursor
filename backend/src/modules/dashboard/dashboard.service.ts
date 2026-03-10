import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { scopeWhere, ScopeContext } from 'src/common/utils/scope-filter.util';

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
    const simScope = scopeWhere(scope, { viaShipment: true });
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
    const irScope = scopeWhere(scope, { viaMeter: true });
    const where = irScope ? { AND: [irScope] } : {};

    const records = await this.prisma.installationRecord.findMany({
      where,
      take: limit,
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
    const irScope = scopeWhere(scope, { viaMeter: true });
    const where = irScope ? { AND: [irScope] } : {};

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const records = await this.prisma.installationRecord.findMany({
      where: {
        ...where,
        createdAt: { gte: startDate },
      },
      select: { createdAt: true },
    });

    const byDate = new Map<string, number>();
    for (let i = 0; i <= days; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      byDate.set(d.toISOString().slice(0, 10), 0);
    }
    records.forEach((r) => {
      const key = r.createdAt.toISOString().slice(0, 10);
      if (byDate.has(key)) {
        byDate.set(key, (byDate.get(key) ?? 0) + 1);
      }
    });

    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));
  }
}
