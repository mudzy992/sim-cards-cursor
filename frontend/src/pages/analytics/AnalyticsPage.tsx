import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Col, Row, Segmented, Table } from 'antd';
import {
  analyticsApi,
  type AnalyticsRange,
  type TimeRangeParams,
} from '@/api/analytics.api';
import { useTranslation } from '@/i18n';
import { getSimCardStatusLabel, getUserRoleLabel } from '@/utils/labels.utils';
import type { SimCardStatus } from '@/types/sim-card.types';
import type { UserRole } from '@/types/auth.types';
import {
  EmptyNotice,
  PageHeader,
  PageShell,
  SectionCard,
  StatusBadge,
  getUserRoleTone,
} from '@/components/ui';
import { FALLBACK_DASH } from '@/constants/ui';
import { formatNumber, getActiveIntlLocale } from '@/utils/formatters';

const statusLabelKey: Record<string, string> = {
  DRAFT: 'installationRecords.status.draft',
  SENT: 'installationRecords.status.sent',
  SEND_FAILED: 'installationRecords.status.sendFailed',
  SEP_ACTIVATED: 'installationRecords.status.sepActivated',
  LEGACY_COMPLETED: 'installationRecords.status.legacyCompleted',
};

function getRangeOptions(t: (key: string) => string): { label: string; value: AnalyticsRange }[] {
  return [
    { label: t('analytics.range.days7'), value: '7_DAYS' },
    { label: t('analytics.range.days30'), value: '30_DAYS' },
    { label: t('analytics.range.month'), value: 'MONTH' },
    { label: t('analytics.range.year'), value: 'YEAR' },
  ];
}

function useTimeRange(): [TimeRangeParams, (r: AnalyticsRange) => void] {
  const [range, setRange] = useState<AnalyticsRange>('30_DAYS');
  return [{ range }, setRange];
}

export default function AnalyticsPage() {
  const { t, language } = useTranslation();
  const dateLocale = getActiveIntlLocale(language);
  const rangeOptions = getRangeOptions(t);
  const [rangeParams, setRangeRange] = useTimeRange();

  const overviewQuery = useQuery({
    queryKey: ['analytics-overview', rangeParams],
    queryFn: () => analyticsApi.getOverview(rangeParams),
  });

  const recordsQuery = useQuery({
    queryKey: ['analytics-records', rangeParams],
    queryFn: () => analyticsApi.getInstallationRecords(rangeParams),
  });

  const simQuery = useQuery({
    queryKey: ['analytics-sim', rangeParams],
    queryFn: () => analyticsApi.getSimCards(rangeParams),
  });

  const usersQuery = useQuery({
    queryKey: ['analytics-users', rangeParams],
    queryFn: () => analyticsApi.getUsers(rangeParams),
  });

  const handleDownloadCsv = async (
    report: 'overview' | 'sim-cards' | 'installation-records' | 'users',
  ) => {
    const blob = await analyticsApi.downloadCsv(report, rangeParams);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const overview = overviewQuery.data;
  const records = recordsQuery.data;
  const sim = simQuery.data;
  const users = usersQuery.data ?? [];

  const maxSimCount = Math.max(
    1,
    ...Object.values(sim?.byStatus ?? {}).map((c) => c ?? 0),
  );
  const maxFunnelCount = Math.max(
    1,
    ...Object.values(records?.funnel ?? {}).map((c) => c ?? 0),
  );
  const maxTimelineCount = Math.max(
    1,
    ...(records?.timeline ?? []).map((c) => c.count ?? 0),
  );

  return (
    <PageShell>
      <PageHeader
        title={t('layout.sidebar.analytics')}
        actions={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <span className="text-xs text-fg-secondary sm:text-sm">
              {t('analytics.timeRangeLabel')}
            </span>
            <Segmented
              options={rangeOptions}
              value={rangeParams.range ?? '30_DAYS'}
              onChange={(v) => setRangeRange(v as AnalyticsRange)}
            />
          </div>
        }
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <SectionCard
            title={t('analytics.overviewCardTitle')}
            loading={overviewQuery.isLoading}
            actions={
              <Button size="small" onClick={() => void handleDownloadCsv('overview')}>
                CSV
              </Button>
            }
          >
            <div className="space-y-2 text-sm text-fg-primary">
              <div className="flex items-center justify-between">
                <span className="font-medium text-fg-secondary">
                  {t('analytics.recordsTotal')}:
                </span>
                <span className="font-semibold tabular-nums">
                  {formatNumber(overview?.installationRecords.total ?? 0, language)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-fg-secondary">
                  {t('analytics.simCardsTotal')}:
                </span>
                <span className="font-semibold tabular-nums">
                  {formatNumber(overview?.simCards.total ?? 0, language)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-fg-secondary">
                  {t('layout.sidebar.meters')}:
                </span>
                <span className="font-semibold tabular-nums">
                  {formatNumber(overview?.metersTotal ?? 0, language)}
                </span>
              </div>
              <div className="mt-3 border-t border-subtle pt-3">
                <div className="mb-1.5 text-xs font-semibold text-fg-primary">
                  {t('analytics.activationSpeed')}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-fg-secondary">
                  <span>{t('analytics.sampleCount')}</span>
                  <span className="text-right font-mono tabular-nums text-fg-primary">
                    {formatNumber(overview?.activationKpi.count ?? 0, language)}
                  </span>
                  <span>{t('analytics.average')}</span>
                  <span className="text-right font-mono tabular-nums text-fg-primary">
                    {overview?.activationKpi.avgSeconds?.toFixed(0) ?? FALLBACK_DASH}
                  </span>
                  <span>{t('analytics.median')}</span>
                  <span className="text-right font-mono tabular-nums text-fg-primary">
                    {overview?.activationKpi.p50Seconds?.toFixed(0) ?? FALLBACK_DASH}
                  </span>
                  <span>p90:</span>
                  <span className="text-right font-mono tabular-nums text-fg-primary">
                    {overview?.activationKpi.p90Seconds?.toFixed(0) ?? FALLBACK_DASH}
                  </span>
                </div>
              </div>
            </div>
          </SectionCard>
        </Col>

        <Col xs={24} lg={8}>
          <SectionCard
            title={t('analytics.simByStatusTitle')}
            loading={simQuery.isLoading}
            actions={
              <Button size="small" onClick={() => void handleDownloadCsv('sim-cards')}>
                CSV
              </Button>
            }
          >
            <div className="space-y-2">
              {sim?.byStatus ? (
                Object.entries(sim.byStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center gap-2 text-xs">
                    <span className="w-28 truncate text-fg-secondary">
                      {getSimCardStatusLabel(status as SimCardStatus, t)}
                    </span>
                    <div className="h-3 flex-1 overflow-hidden rounded border border-subtle bg-surface-sunken">
                      <div
                        className="h-full rounded bg-status-success-fg"
                        style={{
                          width: `${Math.min(100, ((count ?? 0) / maxSimCount) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="w-8 text-right font-mono tabular-nums text-fg-primary">
                      {formatNumber(count ?? 0, language)}
                    </span>
                  </div>
                ))
              ) : (
                <span className="text-xs text-fg-muted">{t('common.states.noData')}</span>
              )}
            </div>
          </SectionCard>
        </Col>

        <Col xs={24} lg={8}>
          <SectionCard
            title={t('analytics.recordsFunnelTitle')}
            loading={recordsQuery.isLoading}
            actions={
              <Button
                size="small"
                onClick={() => void handleDownloadCsv('installation-records')}
              >
                CSV
              </Button>
            }
          >
            <div className="space-y-2">
              {records?.funnel ? (
                Object.entries(records.funnel).map(([status, count]) => (
                  <div key={status} className="flex items-center gap-2 text-xs">
                    <span className="w-32 truncate text-fg-secondary">
                      {statusLabelKey[status] ? t(statusLabelKey[status]) : status}
                    </span>
                    <div className="h-3 flex-1 overflow-hidden rounded border border-subtle bg-surface-sunken">
                      <div
                        className="h-full rounded bg-status-info-fg"
                        style={{
                          width: `${Math.min(100, ((count ?? 0) / maxFunnelCount) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="w-8 text-right font-mono tabular-nums text-fg-primary">
                      {formatNumber(count ?? 0, language)}
                    </span>
                  </div>
                ))
              ) : (
                <span className="text-xs text-fg-muted">{t('common.states.noData')}</span>
              )}
            </div>
          </SectionCard>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <SectionCard title={t('analytics.simByDistributionTitle')} loading={simQuery.isLoading}>
            <div className="-mx-4 overflow-x-auto px-4">
              <Table
                dataSource={sim?.byDistribution ?? []}
                rowKey="distributionId"
                size="small"
                pagination={false}
                locale={{ emptyText: <EmptyNotice /> }}
                scroll={{ x: 'max-content' }}
                columns={[
                  { title: t('analytics.distributionColumn'), dataIndex: 'distributionName' },
                  { title: t('layout.sidebar.simCards'), dataIndex: 'total' },
                ]}
              />
            </div>
          </SectionCard>
        </Col>
        <Col xs={24} lg={12}>
          <SectionCard title={t('analytics.simByBranchTitle')} loading={simQuery.isLoading}>
            <div className="-mx-4 overflow-x-auto px-4">
              <Table
                dataSource={sim?.byBranch ?? []}
                rowKey="branchId"
                size="small"
                pagination={false}
                locale={{ emptyText: <EmptyNotice /> }}
                scroll={{ x: 'max-content' }}
                columns={[
                  { title: t('analytics.distributionColumn'), dataIndex: 'distributionName' },
                  { title: t('analytics.branchColumn'), dataIndex: 'branchName' },
                  { title: t('analytics.installedSimColumn'), dataIndex: 'installedCount' },
                ]}
              />
            </div>
          </SectionCard>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24}>
          <SectionCard title={t('analytics.simByOperatorTitle')} loading={simQuery.isLoading}>
            <div className="-mx-4 overflow-x-auto px-4">
              <Table
                dataSource={sim?.byOperator ?? []}
                rowKey="userId"
                size="small"
                pagination={false}
                locale={{ emptyText: <EmptyNotice /> }}
                scroll={{ x: 'max-content' }}
                columns={[
                  {
                    title: t('analytics.operatorColumn'),
                    render: (_: unknown, row) => `${row.firstName} ${row.lastName}`,
                  },
                  { title: t('analytics.distributionColumn'), dataIndex: 'distributionName' },
                  { title: t('analytics.branchColumn'), dataIndex: 'branchName' },
                  { title: t('analytics.assignedSimColumn'), dataIndex: 'totalAssigned' },
                  { title: t('analytics.installedSimColumnShort'), dataIndex: 'totalInstalled' },
                ]}
              />
            </div>
          </SectionCard>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <SectionCard title={t('analytics.timelineTitle')} loading={recordsQuery.isLoading}>
            {records?.timeline?.length ? (
              <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto pr-1">
                {records.timeline.map(({ date, count }) => (
                  <div key={date} className="flex items-center gap-2">
                    <span className="w-20 shrink-0 font-mono text-xs text-fg-secondary tabular-nums">
                      {new Date(date).toLocaleDateString(dateLocale, {
                        day: '2-digit',
                        month: '2-digit',
                      })}
                    </span>
                    <div className="h-4 flex-1 overflow-hidden rounded border border-subtle bg-surface-sunken">
                      <div
                        className="h-full rounded bg-accent"
                        style={{
                          width: `${Math.min(100, ((count ?? 0) / maxTimelineCount) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right font-mono text-xs text-fg-primary tabular-nums">
                      {formatNumber(count ?? 0, language)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-xs text-fg-muted">{t('analytics.noDataForRange')}</span>
            )}
          </SectionCard>
        </Col>

        <Col xs={24} lg={12}>
          <SectionCard
            title={t('analytics.userActivityTitle')}
            loading={usersQuery.isLoading}
            actions={
              <Button size="small" onClick={() => void handleDownloadCsv('users')}>
                CSV
              </Button>
            }
          >
            <div className="-mx-4 overflow-x-auto px-4">
              <Table
                dataSource={users}
                rowKey="userId"
                size="small"
                pagination={false}
                locale={{ emptyText: <EmptyNotice /> }}
                scroll={{ x: 'max-content' }}
                columns={[
                  {
                    title: t('common.labels.username'),
                    render: (_: unknown, row) => `${row.firstName} ${row.lastName}`,
                  },
                  { title: t('common.labels.email'), dataIndex: 'email' },
                  {
                    title: t('common.labels.role'),
                    dataIndex: 'role',
                    render: (r: string) => (
                      <StatusBadge
                        tone={getUserRoleTone(r)}
                        label={getUserRoleLabel(r as UserRole, t)}
                      />
                    ),
                  },
                  { title: t('analytics.createdRecordsColumn'), dataIndex: 'created' },
                  { title: t('analytics.approvedRecordsColumn'), dataIndex: 'approved' },
                ]}
              />
            </div>
          </SectionCard>
        </Col>
      </Row>
    </PageShell>
  );
}
