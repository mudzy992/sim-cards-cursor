import { useQuery } from '@tanstack/react-query';
import { Col, Row, Table } from 'antd';
import { Link } from 'react-router-dom';
import { dashboardApi } from '@/api/dashboard.api';
import type { RecentRecord } from '@/api/dashboard.api';
import {
  FileTextOutlined,
  InboxOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useTranslation } from '@/i18n';
import {
  EmptyNotice,
  PageHeader,
  PageShell,
  SectionCard,
  StatCard,
  StatusBadge,
  getRecordStatusTone,
} from '@/components/ui';
import { ROUTES } from '@/config/routes';
import { FALLBACK_DASH } from '@/constants/ui';
import { formatDate, formatNumber, getActiveIntlLocale } from '@/utils/formatters';

const statusLabelKey: Record<string, string> = {
  DRAFT: 'installationRecords.status.draft',
  SENT: 'installationRecords.status.sent',
  SEND_FAILED: 'installationRecords.status.sendFailed',
  SEP_ACTIVATED: 'installationRecords.status.sepActivated',
  LEGACY_COMPLETED: 'installationRecords.status.legacyCompleted',
};

export default function DashboardPage() {
  const { t, language } = useTranslation();
  const statsQuery = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardApi.getStats(),
  });

  const recentQuery = useQuery({
    queryKey: ['dashboard-recent-records'],
    queryFn: () => dashboardApi.getRecentRecords(10),
  });

  const chartQuery = useQuery({
    queryKey: ['dashboard-records-chart', 30],
    queryFn: () => dashboardApi.getRecordsChart(30),
  });

  const stats = statsQuery.data;
  const recent = recentQuery.data ?? [];
  const chartData = chartQuery.data ?? [];

  const statusLabel = (status: string) =>
    statusLabelKey[status] ? t(statusLabelKey[status]) : status;

  const dateLocale = getActiveIntlLocale(language);
  const maxChartCount = Math.max(1, ...chartData.map((c) => c.count));

  return (
    <PageShell>
      <div
        className="space-y-6"
        data-tour-id="admin-dashboard"
        data-tour-role="SYSTEM_ADMIN DIST_ADMIN"
      >
        <PageHeader title={t('dashboard.title')} />

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              label={t('dashboard.stats.recordsTotal')}
              value={formatNumber(stats?.installationRecords?.total ?? 0, language)}
              icon={<FileTextOutlined />}
              tone="accent"
              loading={statsQuery.isLoading}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              label={t('dashboard.stats.simCards')}
              value={formatNumber(stats?.simCards?.total ?? 0, language)}
              hint={t('dashboard.stats.simCardsBreakdown', {
                available: stats?.simCards?.available ?? 0,
                installed: stats?.simCards?.installed ?? 0,
              })}
              icon={<InboxOutlined />}
              tone="info"
              loading={statsQuery.isLoading}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              label={t('dashboard.stats.meters')}
              value={formatNumber(stats?.meters ?? 0, language)}
              icon={<ThunderboltOutlined />}
              tone="success"
              loading={statsQuery.isLoading}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <SectionCard loading={statsQuery.isLoading}>
              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-wide text-fg-muted">
                  {t('dashboard.stats.recordsByStatus')}
                </div>
                <div className="flex flex-wrap gap-2">
                  {stats?.installationRecords?.byStatus &&
                    Object.entries(stats.installationRecords.byStatus).map(
                      ([status, count]) => (
                        <StatusBadge
                          key={status}
                          tone={getRecordStatusTone(status)}
                          label={`${statusLabel(status)}: ${formatNumber(count, language)}`}
                        />
                      ),
                    )}
                  {(!stats?.installationRecords?.byStatus ||
                    Object.keys(stats.installationRecords.byStatus).length === 0) && (
                    <span className="text-xs text-fg-muted">{t('common.states.noData')}</span>
                  )}
                </div>
              </div>
            </SectionCard>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <SectionCard
              title={t('dashboard.recentRecords.title')}
              loading={recentQuery.isLoading}
              actions={
                <Link
                  to={ROUTES.installationRecords}
                  className="text-sm font-medium text-accent-fg hover:underline"
                >
                  {t('dashboard.recentRecords.viewAll')}
                </Link>
              }
            >
              <Table
                dataSource={recent}
                rowKey="id"
                size="small"
                pagination={false}
                locale={{ emptyText: <EmptyNotice /> }}
                columns={[
                  {
                    title: t('dashboard.recentRecords.columns.number'),
                    dataIndex: 'recordNumber',
                    render: (val: string, row: RecentRecord) => (
                      <Link
                        to={ROUTES.installationRecordDetail(row.id)}
                        className="font-mono text-accent-fg hover:underline"
                      >
                        {val}
                      </Link>
                    ),
                  },
                  {
                    title: t('common.labels.status'),
                    dataIndex: 'status',
                    render: (s: string) => (
                      <StatusBadge tone={getRecordStatusTone(s)} label={statusLabel(s)} />
                    ),
                  },
                  {
                    title: t('dashboard.recentRecords.columns.meter'),
                    render: (_: unknown, row: RecentRecord) =>
                      row.meter?.serialNumber ?? FALLBACK_DASH,
                  },
                  {
                    title: t('dashboard.recentRecords.columns.installedBy'),
                    render: (_: unknown, row: RecentRecord) =>
                      row.installedBy
                        ? `${row.installedBy.firstName} ${row.installedBy.lastName}`
                        : FALLBACK_DASH,
                  },
                  {
                    title: t('common.labels.date'),
                    dataIndex: 'createdAt',
                    render: (d: string) => formatDate(d, language),
                  },
                ]}
              />
            </SectionCard>
          </Col>
          <Col xs={24} lg={12}>
            <SectionCard title={t('dashboard.recordsChart.title')} loading={chartQuery.isLoading}>
              {chartData.length === 0 ? (
                <EmptyNotice />
              ) : (
                <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto pr-1">
                  {chartData.map(({ date, count }) => {
                    const widthPct = Math.max(0, Math.min(100, (count / maxChartCount) * 100));
                    return (
                      <div key={date} className="flex items-center gap-2">
                        <span className="w-20 shrink-0 font-mono text-xs text-fg-secondary tabular-nums">
                          {new Date(date).toLocaleDateString(dateLocale, {
                            day: '2-digit',
                            month: '2-digit',
                          })}
                        </span>
                        <div
                          className="h-5 flex-1 overflow-hidden rounded border border-subtle bg-surface-sunken"
                          title={t('dashboard.recordsChart.barTooltip', { count })}
                        >
                          <div
                            className="h-full rounded bg-accent"
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                        <span className="w-8 shrink-0 text-right font-mono text-xs text-fg-primary tabular-nums">
                          {formatNumber(count, language)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          </Col>
        </Row>
      </div>
    </PageShell>
  );
}
