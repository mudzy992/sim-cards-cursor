import { Injectable } from '@nestjs/common';
import { Prisma, RecordStatus, SimCardStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { scopeWhere, ScopeContext } from 'src/common/utils/scope-filter.util';

export type AnalyticsRange =
  | 'TODAY'
  | '7_DAYS'
  | '30_DAYS'
  | 'MONTH'
  | 'YEAR'
  | 'CUSTOM';

export interface TimeRangeParams {
  range?: AnalyticsRange;
  from?: string;
  to?: string;
}

export interface OverviewAnalytics {
  installationRecords: {
    total: number;
    byStatus: Record<string, number>;
  };
  simCards: {
    total: number;
    byStatus: Record<string, number>;
  };
  metersTotal: number;
  activationKpi: {
    count: number;
    avgSeconds: number | null;
    p50Seconds: number | null;
    p90Seconds: number | null;
  };
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private resolveRange(params: TimeRangeParams): { from: Date; to: Date } {
    const now = new Date();
    const end = new Date(now);
    end.setMilliseconds(999);

    const { range, from, to } = params;

    if (range === 'CUSTOM' && from && to) {
      const fromDate = new Date(from);
      const toDate = new Date(to);
      return { from: fromDate, to: toDate };
    }

    const start = new Date(now);
    switch (range) {
      case 'TODAY':
        start.setHours(0, 0, 0, 0);
        break;
      case '7_DAYS':
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        break;
      case '30_DAYS':
        start.setDate(start.getDate() - 30);
        start.setHours(0, 0, 0, 0);
        break;
      case 'MONTH': {
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        break;
      }
      case 'YEAR':
        start.setMonth(0, 1);
        start.setHours(0, 0, 0, 0);
        break;
      default:
        // default 30 dana
        start.setDate(start.getDate() - 30);
        start.setHours(0, 0, 0, 0);
    }

    return { from: start, to: end };
  }

  async getOverview(
    params: TimeRangeParams,
    scope?: ScopeContext | null,
  ): Promise<OverviewAnalytics> {
    const { from, to } = this.resolveRange(params);

    const irScope = scopeWhere(scope, { viaMeter: true });
    const simScope = scopeWhere(scope, { viaShipment: true });
    const meterScope = scopeWhere(scope, { branchIdField: 'branchId' });

    const irWhere: Prisma.InstallationRecordWhereInput = {
      ...(irScope ? { AND: [irScope] } : {}),
      createdAt: {
        gte: from,
        lte: to,
      },
    };

    const simWhere: Prisma.SimCardWhereInput = {
      ...(simScope ? { AND: [simScope] } : {}),
      createdAt: {
        gte: from,
        lte: to,
      },
    };

    const meterWhere: Prisma.MeterWhereInput = {
      ...(meterScope ? { AND: [meterScope] } : {}),
      createdAt: {
        gte: from,
        lte: to,
      },
    };

    const [irByStatus, irTotal, simCounts, meterCount, activationSamples] =
      await Promise.all([
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
        this.collectActivationSamples(from, to, scope),
      ]);

    const irByStatusMap: Record<string, number> = {};
    irByStatus.forEach((r) => {
      irByStatusMap[r.status] = r._count.id;
    });

    const simByStatusMap: Record<string, number> = {};
    Object.values(SimCardStatus).forEach((status) => {
      simByStatusMap[status] = 0;
    });
    simCounts.forEach((r) => {
      simByStatusMap[r.status] = r._count.id;
    });

    const activationKpi = this.computeKpi(activationSamples);

    return {
      installationRecords: {
        total: irTotal,
        byStatus: irByStatusMap,
      },
      simCards: {
        total: simCounts.reduce((acc, r) => acc + r._count.id, 0),
        byStatus: simByStatusMap,
      },
      metersTotal: meterCount,
      activationKpi,
    };
  }

  private async collectActivationSamples(
    from: Date,
    to: Date,
    scope?: ScopeContext | null,
  ): Promise<number[]> {
    // približan KPI: vrijeme od kreiranja zapisnika do ACTIVATED_IN_SEP,
    // računato iz installation_records polja (bez oslanjanja na SimEvent).
    const irScope = scopeWhere(scope, { viaMeter: true });
    const where: Prisma.InstallationRecordWhereInput = {
      ...(irScope ? { AND: [irScope] } : {}),
      createdAt: { gte: from, lte: to },
      status: RecordStatus.ACTIVATED_IN_SEP,
    };

    const records = await this.prisma.installationRecord.findMany({
      where,
      select: { createdAt: true, approvedAt: true, sentAt: true },
    });

    const samples: number[] = [];
    for (const r of records) {
      const start = r.createdAt;
      const end = r.sentAt ?? r.approvedAt ?? null;
      if (!end) continue;
      const diffSeconds = (end.getTime() - start.getTime()) / 1000;
      if (diffSeconds >= 0) {
        samples.push(diffSeconds);
      }
    }
    return samples;
  }

  private computeKpi(samples: number[]): {
    count: number;
    avgSeconds: number | null;
    p50Seconds: number | null;
    p90Seconds: number | null;
  } {
    if (!samples.length) {
      return {
        count: 0,
        avgSeconds: null,
        p50Seconds: null,
        p90Seconds: null,
      };
    }
    const sorted = [...samples].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, v) => acc + v, 0);
    const avg = sum / sorted.length;
    const p = (p: number) =>
      sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
    return {
      count: sorted.length,
      avgSeconds: avg,
      p50Seconds: p(50),
      p90Seconds: p(90),
    };
  }

  async getInstallationRecordsAnalytics(
    params: TimeRangeParams,
    scope?: ScopeContext | null,
  ) {
    const { from, to } = this.resolveRange(params);
    const irScope = scopeWhere(scope, { viaMeter: true });
    const where: Prisma.InstallationRecordWhereInput = {
      ...(irScope ? { AND: [irScope] } : {}),
      createdAt: { gte: from, lte: to },
    };

    const [byStatus, byDay] = await Promise.all([
      this.prisma.installationRecord.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
      }),
      this.prisma.installationRecord.findMany({
        where,
        select: { createdAt: true },
      }),
    ]);

    const funnel: Record<string, number> = {};
    byStatus.forEach((r) => {
      funnel[r.status] = r._count.id;
    });

    const byDate = new Map<string, number>();
    const dayMs = 24 * 60 * 60 * 1000;
    for (
      let t = from.getTime();
      t <= to.getTime();
      t += dayMs
    ) {
      const d = new Date(t);
      byDate.set(d.toISOString().slice(0, 10), 0);
    }
    byDay.forEach((r) => {
      const key = r.createdAt.toISOString().slice(0, 10);
      if (byDate.has(key)) {
        byDate.set(key, (byDate.get(key) ?? 0) + 1);
      }
    });

    const timeline = Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    return { funnel, timeline };
  }

  async getSimCardsAnalytics(
    params: TimeRangeParams,
    scope?: ScopeContext | null,
  ) {
    const { from, to } = this.resolveRange(params);
    const simScope = scopeWhere(scope, { viaShipment: true });
    const where: Prisma.SimCardWhereInput = {
      ...(simScope ? { AND: [simScope] } : {}),
      createdAt: { gte: from, lte: to },
    };

    const grouped = await this.prisma.simCard.groupBy({
      by: ['status'],
      where,
      _count: { id: true },
    });

    const byStatus: Record<string, number> = {};
    Object.values(SimCardStatus).forEach((s) => (byStatus[s] = 0));
    grouped.forEach((g) => {
      byStatus[g.status] = g._count.id;
    });

    // Organizacijski breakdown: po distribuciji, podružnici, operatorima
    const simCards = await this.prisma.simCard.findMany({
      where,
      select: {
        id: true,
        status: true,
        shipment: {
          select: {
            distributionId: true,
            distribution: { select: { id: true, name: true } },
          },
        },
        meter: {
          select: {
            branchId: true,
            branch: {
              select: {
                id: true,
                name: true,
                distributionId: true,
                distribution: { select: { id: true, name: true } },
              },
            },
          },
        },
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            branchId: true,
            branch: {
              select: {
                id: true,
                name: true,
                distributionId: true,
                distribution: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    const byDistribution: Record<
      string,
      { distributionId: string; distributionName: string; total: number }
    > = {};

    const byBranch: Record<
      string,
      {
        branchId: string;
        branchName: string;
        distributionName: string;
        installedCount: number;
      }
    > = {};

    const byOperator: Record<
      string,
      {
        userId: string;
        firstName: string;
        lastName: string;
        branchName: string;
        distributionName: string;
        totalAssigned: number;
        totalInstalled: number;
      }
    > = {};

    for (const sim of simCards) {
      const dist =
        sim.shipment?.distribution ??
        sim.meter?.branch?.distribution ??
        sim.assignedTo?.branch?.distribution;
      if (dist) {
        if (!byDistribution[dist.id]) {
          byDistribution[dist.id] = {
            distributionId: dist.id,
            distributionName: dist.name,
            total: 0,
          };
        }
        byDistribution[dist.id].total += 1;
      }

      if (sim.meter?.branch && sim.status === SimCardStatus.INSTALLED) {
        const b = sim.meter.branch;
        if (!byBranch[b.id]) {
          byBranch[b.id] = {
            branchId: b.id,
            branchName: b.name,
            distributionName: b.distribution?.name ?? '',
            installedCount: 0,
          };
        }
        byBranch[b.id].installedCount += 1;
      }

      if (sim.assignedTo) {
        const u = sim.assignedTo;
        const key = u.id;
        if (!byOperator[key]) {
          byOperator[key] = {
            userId: u.id,
            firstName: u.firstName,
            lastName: u.lastName,
            branchName: u.branch?.name ?? '',
            distributionName: u.branch?.distribution?.name ?? '',
            totalAssigned: 0,
            totalInstalled: 0,
          };
        }
        byOperator[key].totalAssigned += 1;
        if (sim.status === SimCardStatus.INSTALLED) {
          byOperator[key].totalInstalled += 1;
        }
      }
    }

    return {
      byStatus,
      byDistribution: Object.values(byDistribution),
      byBranch: Object.values(byBranch),
      byOperator: Object.values(byOperator),
    };
  }

  async getUsersAnalytics(
    params: TimeRangeParams,
    scope?: ScopeContext | null,
  ) {
    const { from, to } = this.resolveRange(params);
    const irScope = scopeWhere(scope, { viaMeter: true });
    const where: Prisma.InstallationRecordWhereInput = {
      ...(irScope ? { AND: [irScope] } : {}),
      createdAt: { gte: from, lte: to },
    };

    const records = await this.prisma.installationRecord.findMany({
      where,
      select: {
        installedById: true,
        approvedById: true,
      },
    });

    const perUser: Record<
      string,
      { created: number; approved: number }
    > = {};
    for (const r of records) {
      if (r.installedById) {
        if (!perUser[r.installedById]) {
          perUser[r.installedById] = { created: 0, approved: 0 };
        }
        perUser[r.installedById].created += 1;
      }
      if (r.approvedById) {
        if (!perUser[r.approvedById]) {
          perUser[r.approvedById] = { created: 0, approved: 0 };
        }
        perUser[r.approvedById].approved += 1;
      }
    }

    const userIds = Object.keys(perUser);
    if (!userIds.length) {
      return [];
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
      },
    });

    return users.map((u) => ({
      userId: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      role: u.role,
      created: perUser[u.id]?.created ?? 0,
      approved: perUser[u.id]?.approved ?? 0,
    }));
  }

  async getExportCsv(
    report: 'overview' | 'sim-cards' | 'installation-records' | 'users',
    params: TimeRangeParams,
    scope?: ScopeContext | null,
  ): Promise<{ filename: string; content: string }> {
    const { from, to } = this.resolveRange(params);
    const rangeLabel = `${from.toISOString().slice(0, 10)}_to_${to
      .toISOString()
      .slice(0, 10)}`;

    if (report === 'overview') {
      const data = await this.getOverview(params, scope);
      const lines = [
        'metric,value',
        `ir_total,${data.installationRecords.total}`,
        ...Object.entries(data.installationRecords.byStatus).map(
          ([status, v]) => `ir_status_${status},${v}`,
        ),
        `sim_total,${data.simCards.total}`,
        ...Object.entries(data.simCards.byStatus).map(
          ([status, v]) => `sim_status_${status},${v}`,
        ),
        `meters_total,${data.metersTotal}`,
        `activation_count,${data.activationKpi.count}`,
        `activation_avg_seconds,${data.activationKpi.avgSeconds ?? ''}`,
        `activation_p50_seconds,${data.activationKpi.p50Seconds ?? ''}`,
        `activation_p90_seconds,${data.activationKpi.p90Seconds ?? ''}`,
      ];
      return {
        filename: `overview_${rangeLabel}.csv`,
        content: lines.join('\n'),
      };
    }

    if (report === 'sim-cards') {
      const data = await this.getSimCardsAnalytics(params, scope);
      const lines = ['status,count'];
      for (const [status, count] of Object.entries(data.byStatus)) {
        lines.push(`${status},${count}`);
      }
      return {
        filename: `sim-cards_${rangeLabel}.csv`,
        content: lines.join('\n'),
      };
    }

    if (report === 'installation-records') {
      const data = await this.getInstallationRecordsAnalytics(params, scope);
      const lines = ['status,count'];
      for (const [status, count] of Object.entries(data.funnel)) {
        lines.push(`${status},${count}`);
      }
      return {
        filename: `records_${rangeLabel}.csv`,
        content: lines.join('\n'),
      };
    }

    if (report === 'users') {
      const rows = await this.getUsersAnalytics(params, scope);
      const header =
        'userId,firstName,lastName,email,role,createdRecords,approvedRecords';
      const lines = [header];
      for (const r of rows) {
        lines.push(
          [
            r.userId,
            r.firstName,
            r.lastName,
            r.email,
            r.role,
            r.created,
            r.approved,
          ]
            .map((v) =>
              typeof v === 'string' && v.includes(',')
                ? `"${v.replace(/"/g, '""')}"`
                : v,
            )
            .join(','),
        );
      }
      return {
        filename: `users_${rangeLabel}.csv`,
        content: lines.join('\n'),
      };
    }

    throw new Error('Unsupported report type');
  }
}

