import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Prisma, RecordStatus, SimCardStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  isScopedAdminOrModerator,
  scopeWhere,
  simCardScopeWhere,
  ScopeContext,
} from 'src/common/utils/scope-filter.util';

const DAY_MS = 86_400_000;
const TIMELINE_BATCH_SIZE = 5000;
const TIMELINE_MAX_ROWS = 50_000;
const ACTIVATION_SAMPLE_LIMIT = 5000;

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
    const end = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        23,
        59,
        59,
        999,
      ),
    );

    const { range, from, to } = params;

    if (range === 'CUSTOM') {
      if (!from || !to) {
        throw new BadRequestException(
          'CUSTOM range requires both "from" and "to" dates',
        );
      }
      const fromDate = new Date(from);
      const toDate = new Date(to);
      if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
        throw new BadRequestException('Invalid date format for "from" or "to"');
      }
      if (fromDate.getTime() > toDate.getTime()) {
        throw new BadRequestException(
          '"from" date must be earlier than or equal to "to" date',
        );
      }
      const maxSpanMs = 366 * DAY_MS;
      if (toDate.getTime() - fromDate.getTime() > maxSpanMs) {
        throw new BadRequestException('CUSTOM date range cannot exceed 366 days');
      }
      return { from: fromDate, to: toDate };
    }

    const todayUtcStartMs = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0,
      0,
      0,
      0,
    );

    let startMs: number;
    switch (range) {
      case 'TODAY':
        startMs = todayUtcStartMs;
        break;
      case '7_DAYS':
        startMs = todayUtcStartMs - 7 * DAY_MS;
        break;
      case '30_DAYS':
        startMs = todayUtcStartMs - 30 * DAY_MS;
        break;
      case 'MONTH':
        startMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0);
        break;
      case 'YEAR':
        startMs = Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0);
        break;
      default:
        startMs = todayUtcStartMs - 30 * DAY_MS;
    }

    return { from: new Date(startMs), to: end };
  }

  async getOverview(
    params: TimeRangeParams,
    scope?: ScopeContext | null,
  ): Promise<OverviewAnalytics> {
    const { from, to } = this.resolveRange(params);

    const irScope = scopeWhere(scope, { viaMeter: true });
    const simScope = simCardScopeWhere<Prisma.SimCardWhereInput>(scope);
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
    const irScope = scopeWhere(scope, { viaMeter: true });
    const where: Prisma.InstallationRecordWhereInput = {
      ...(irScope ? { AND: [irScope] } : {}),
      createdAt: { gte: from, lte: to },
      status: RecordStatus.SEP_ACTIVATED,
    };

    const records = await this.prisma.installationRecord.findMany({
      where,
      select: { createdAt: true, approvedAt: true, sentAt: true },
      orderBy: { createdAt: 'desc' },
      take: ACTIVATION_SAMPLE_LIMIT,
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
    const p = (pct: number) =>
      sorted[Math.min(sorted.length - 1, Math.floor((pct / 100) * sorted.length))];
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

    const byStatus = await this.prisma.installationRecord.groupBy({
      by: ['status'],
      where,
      _count: { id: true },
    });

    const funnel: Record<string, number> = {};
    byStatus.forEach((r) => {
      funnel[r.status] = r._count.id;
    });

    const byDate = new Map<string, number>();
    const startUtcDay = Date.UTC(
      from.getUTCFullYear(),
      from.getUTCMonth(),
      from.getUTCDate(),
    );
    const endUtcDay = Date.UTC(
      to.getUTCFullYear(),
      to.getUTCMonth(),
      to.getUTCDate(),
    );
    for (let t = startUtcDay; t <= endUtcDay; t += DAY_MS) {
      byDate.set(new Date(t).toISOString().slice(0, 10), 0);
    }

    let cursorId: string | undefined;
    let processed = 0;
    while (processed < TIMELINE_MAX_ROWS) {
      const batch = await this.prisma.installationRecord.findMany({
        where,
        select: { id: true, createdAt: true },
        orderBy: { id: 'asc' },
        take: TIMELINE_BATCH_SIZE,
        ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      });

      for (const r of batch) {
        const key = r.createdAt.toISOString().slice(0, 10);
        if (byDate.has(key)) {
          byDate.set(key, (byDate.get(key) ?? 0) + 1);
        }
      }

      processed += batch.length;
      if (batch.length < TIMELINE_BATCH_SIZE || !batch[batch.length - 1]?.id) {
        break;
      }
      cursorId = batch[batch.length - 1].id;
    }

    const timeline = Array.from(byDate.entries()).map(([date, count]) => ({
      date,
      count,
    }));

    return { funnel, timeline };
  }

  async getSimCardsAnalytics(
    params: TimeRangeParams,
    scope?: ScopeContext | null,
  ) {
    const { from, to } = this.resolveRange(params);
    const simScope = simCardScopeWhere<Prisma.SimCardWhereInput>(scope);
    const where: Prisma.SimCardWhereInput = {
      ...(simScope ? { AND: [simScope] } : {}),
      createdAt: { gte: from, lte: to },
    };

    const [groupedByStatus, groupedByShipment, groupedByBranch, groupedByOperator] =
      await Promise.all([
        this.prisma.simCard.groupBy({
          by: ['status'],
          where,
          _count: { id: true },
        }),
        this.prisma.simCard.groupBy({
          by: ['shipmentId'],
          where,
          _count: { id: true },
        }),
        this.prisma.meter.groupBy({
          by: ['branchId'],
          where: {
            branchId: { not: null },
            simCard: {
              is: {
                ...where,
                status: SimCardStatus.INSTALLED,
              },
            },
          },
          _count: { id: true },
        }),
        this.prisma.simCard.groupBy({
          by: ['assignedToId', 'status'],
          where: {
            ...where,
            assignedToId: { not: null },
          },
          _count: { id: true },
        }),
      ]);

    const byStatus: Record<string, number> = {};
    Object.values(SimCardStatus).forEach((s) => (byStatus[s] = 0));
    groupedByStatus.forEach((g) => {
      byStatus[g.status] = g._count.id;
    });

    const shipmentIds = groupedByShipment.map((g) => g.shipmentId);
    const shipments = shipmentIds.length
      ? await this.prisma.shipment.findMany({
          where: { id: { in: shipmentIds } },
          select: {
            id: true,
            distribution: { select: { id: true, name: true } },
          },
        })
      : [];
    const shipmentDistMap = new Map(
      shipments.map((s) => [s.id, s.distribution ?? null]),
    );

    const byDistribution: Record<
      string,
      { distributionId: string; distributionName: string; total: number }
    > = {};
    for (const row of groupedByShipment) {
      const dist = shipmentDistMap.get(row.shipmentId);
      if (!dist) continue;
      if (!byDistribution[dist.id]) {
        byDistribution[dist.id] = {
          distributionId: dist.id,
          distributionName: dist.name,
          total: 0,
        };
      }
      byDistribution[dist.id].total += row._count.id;
    }

    const branchIds = groupedByBranch
      .map((g) => g.branchId)
      .filter((id): id is string => Boolean(id));
    const branches = branchIds.length
      ? await this.prisma.branch.findMany({
          where: { id: { in: branchIds } },
          select: {
            id: true,
            name: true,
            distribution: { select: { name: true } },
          },
        })
      : [];
    const branchMap = new Map(branches.map((b) => [b.id, b]));

    const byBranch: {
      branchId: string;
      branchName: string;
      distributionName: string;
      installedCount: number;
    }[] = [];
    for (const row of groupedByBranch) {
      if (!row.branchId) continue;
      const branch = branchMap.get(row.branchId);
      if (!branch) continue;
      byBranch.push({
        branchId: branch.id,
        branchName: branch.name,
        distributionName: branch.distribution?.name ?? '',
        installedCount: row._count.id,
      });
    }

    const operatorIds = Array.from(
      new Set(
        groupedByOperator
          .map((g) => g.assignedToId)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const operators = operatorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: operatorIds } },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            branch: {
              select: {
                name: true,
                distribution: { select: { name: true } },
              },
            },
          },
        })
      : [];
    const operatorMap = new Map(operators.map((u) => [u.id, u]));

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
    for (const row of groupedByOperator) {
      if (!row.assignedToId) continue;
      const u = operatorMap.get(row.assignedToId);
      if (!u) continue;
      if (!byOperator[u.id]) {
        byOperator[u.id] = {
          userId: u.id,
          firstName: u.firstName,
          lastName: u.lastName,
          branchName: u.branch?.name ?? '',
          distributionName: u.branch?.distribution?.name ?? '',
          totalAssigned: 0,
          totalInstalled: 0,
        };
      }
      byOperator[u.id].totalAssigned += row._count.id;
      if (row.status === SimCardStatus.INSTALLED) {
        byOperator[u.id].totalInstalled += row._count.id;
      }
    }

    return {
      byStatus,
      byDistribution: Object.values(byDistribution),
      byBranch,
      byOperator: Object.values(byOperator),
    };
  }

  async getUsersAnalytics(
    params: TimeRangeParams,
    scope?: ScopeContext | null,
  ) {
    if (!isScopedAdminOrModerator(scope)) {
      throw new ForbiddenException(
        'Only administrators and branch moderators can access user analytics',
      );
    }

    const { from, to } = this.resolveRange(params);
    const irScope = scopeWhere(scope, { viaMeter: true });
    const where: Prisma.InstallationRecordWhereInput = {
      ...(irScope ? { AND: [irScope] } : {}),
      createdAt: { gte: from, lte: to },
    };

    const [createdGroups, approvedGroups] = await Promise.all([
      this.prisma.installationRecord.groupBy({
        by: ['installedById'],
        where,
        _count: { id: true },
      }),
      this.prisma.installationRecord.groupBy({
        by: ['approvedById'],
        where: {
          ...where,
          approvedById: { not: null },
        },
        _count: { id: true },
      }),
    ]);

    const perUser: Record<string, { created: number; approved: number }> = {};
    for (const row of createdGroups) {
      if (!row.installedById) continue;
      if (!perUser[row.installedById]) {
        perUser[row.installedById] = { created: 0, approved: 0 };
      }
      perUser[row.installedById].created += row._count.id;
    }
    for (const row of approvedGroups) {
      if (!row.approvedById) continue;
      if (!perUser[row.approvedById]) {
        perUser[row.approvedById] = { created: 0, approved: 0 };
      }
      perUser[row.approvedById].approved += row._count.id;
    }

    const userIds = Object.keys(perUser);
    if (!userIds.length) {
      return [];
    }

    const userScope = scopeWhere(scope, { userScope: true });
    const users = await this.prisma.user.findMany({
      where: {
        id: { in: userIds },
        ...(userScope ? { AND: [userScope] } : {}),
      },
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

  private escapeCsvCell(value: string | number | null | undefined): string {
    const raw = value === null || value === undefined ? '' : String(value);
    const neutralized = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
    if (/[",\n\r]/.test(neutralized)) {
      return `"${neutralized.replace(/"/g, '""')}"`;
    }
    return neutralized;
  }

  private formatCsv(rows: Array<Array<string | number | null | undefined>>): string {
    return (
      '\uFEFF' +
      rows
        .map((row) => row.map((cell) => this.escapeCsvCell(cell)).join(','))
        .join('\n')
    );
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
      const rows: Array<Array<string | number | null | undefined>> = [
        ['metric', 'value'],
        ['ir_total', data.installationRecords.total],
        ...Object.entries(data.installationRecords.byStatus).map(([status, v]) => [
          `ir_status_${status}`,
          v,
        ]),
        ['sim_total', data.simCards.total],
        ...Object.entries(data.simCards.byStatus).map(([status, v]) => [
          `sim_status_${status}`,
          v,
        ]),
        ['meters_total', data.metersTotal],
        ['activation_count', data.activationKpi.count],
        ['activation_avg_seconds', data.activationKpi.avgSeconds ?? ''],
        ['activation_p50_seconds', data.activationKpi.p50Seconds ?? ''],
        ['activation_p90_seconds', data.activationKpi.p90Seconds ?? ''],
      ];
      return {
        filename: `overview_${rangeLabel}.csv`,
        content: this.formatCsv(rows),
      };
    }

    if (report === 'sim-cards') {
      const data = await this.getSimCardsAnalytics(params, scope);
      const rows: Array<Array<string | number | null | undefined>> = [
        ['status', 'count'],
        ...Object.entries(data.byStatus).map(([status, count]) => [status, count]),
      ];
      return {
        filename: `sim-cards_${rangeLabel}.csv`,
        content: this.formatCsv(rows),
      };
    }

    if (report === 'installation-records') {
      const data = await this.getInstallationRecordsAnalytics(params, scope);
      const rows: Array<Array<string | number | null | undefined>> = [
        ['status', 'count'],
        ...Object.entries(data.funnel).map(([status, count]) => [status, count]),
      ];
      return {
        filename: `records_${rangeLabel}.csv`,
        content: this.formatCsv(rows),
      };
    }

    if (report === 'users') {
      if (!isScopedAdminOrModerator(scope)) {
        throw new ForbiddenException(
          'Only administrators and branch moderators can export user analytics',
        );
      }
      const rowsData = await this.getUsersAnalytics(params, scope);
      const rows: Array<Array<string | number | null | undefined>> = [
        [
          'userId',
          'firstName',
          'lastName',
          'email',
          'role',
          'createdRecords',
          'approvedRecords',
        ],
        ...rowsData.map((r) => [
          r.userId,
          r.firstName,
          r.lastName,
          r.email,
          r.role,
          r.created,
          r.approved,
        ]),
      ];
      return {
        filename: `users_${rangeLabel}.csv`,
        content: this.formatCsv(rows),
      };
    }

    throw new BadRequestException('Unsupported report type');
  }
}
