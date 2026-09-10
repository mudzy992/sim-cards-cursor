import { useQuery } from '@tanstack/react-query';
import { Card, Col, Row, Statistic, Table, Tag, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { dashboardApi } from '@/api/dashboard.api';
import type { RecentRecord } from '@/api/dashboard.api';
import {
  FileTextOutlined,
  InboxOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useTranslation } from '@/i18n';

const statusLabelKey: Record<string, string> = {
  DRAFT: 'installationRecords.status.draft',
  SENT: 'installationRecords.status.sent',
  SEND_FAILED: 'installationRecords.status.sendFailed',
  SEP_ACTIVATED: 'installationRecords.status.sepActivated',
  LEGACY_COMPLETED: 'installationRecords.status.legacyCompleted',
};

const statusColor: Record<string, string> = {
  DRAFT: 'default',
  SENT: 'blue',
  SEND_FAILED: 'error',
  SEP_ACTIVATED: 'success',
  LEGACY_COMPLETED: 'default',
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

  const dateLocale = language === 'bs' ? 'bs-BA' : 'en-US';

  return (
    <div
      className="space-y-6"
      data-tour-id="admin-dashboard"
      data-tour-role="SYSTEM_ADMIN DIST_ADMIN"
    >
      <Typography.Title level={3} className="!mb-0">
        {t('dashboard.title')}
      </Typography.Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={t('dashboard.stats.recordsTotal')}
              value={stats?.installationRecords?.total ?? 0}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={t('dashboard.stats.simCards')}
              value={stats?.simCards?.total ?? 0}
              prefix={<InboxOutlined />}
            />
            <Typography.Text type="secondary" className="text-xs">
              {t('dashboard.stats.simCardsBreakdown', {
                available: stats?.simCards?.available ?? 0,
                installed: stats?.simCards?.installed ?? 0,
              })}
            </Typography.Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={t('dashboard.stats.meters')}
              value={stats?.meters ?? 0}
              prefix={<ThunderboltOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <div className="space-y-1">
              <Typography.Text strong>{t('dashboard.stats.recordsByStatus')}</Typography.Text>
              <div className="flex flex-wrap gap-2 mt-2">
                {stats?.installationRecords?.byStatus &&
                  Object.entries(stats.installationRecords.byStatus).map(
                    ([status, count]) => (
                      <Tag key={status} color={statusColor[status] ?? 'default'}>
                        {statusLabel(status)}: {count}
                      </Tag>
                    ),
                  )}
                {(!stats?.installationRecords?.byStatus ||
                  Object.keys(stats.installationRecords.byStatus).length === 0) && (
                  <Typography.Text type="secondary">{t('common.states.noData')}</Typography.Text>
                )}
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card
            title={t('dashboard.recentRecords.title')}
            loading={recentQuery.isLoading}
            extra={
              <Link to="/installation-records">{t('dashboard.recentRecords.viewAll')}</Link>
            }
          >
            <Table
              dataSource={recent}
              rowKey="id"
              size="small"
              pagination={false}
              columns={[
                {
                  title: t('dashboard.recentRecords.columns.number'),
                  dataIndex: 'recordNumber',
                  render: (val: string, row: RecentRecord) => (
                    <Link to={`/installation-records/${row.id}`}>{val}</Link>
                  ),
                },
                {
                  title: t('common.labels.status'),
                  dataIndex: 'status',
                  render: (s: string) => (
                    <Tag color={statusColor[s]}>{statusLabel(s)}</Tag>
                  ),
                },
                {
                  title: t('dashboard.recentRecords.columns.meter'),
                  render: (_: unknown, row: RecentRecord) =>
                    row.meter?.serialNumber ?? '–',
                },
                {
                  title: t('dashboard.recentRecords.columns.installedBy'),
                  render: (_: unknown, row: RecentRecord) =>
                    row.installedBy
                      ? `${row.installedBy.firstName} ${row.installedBy.lastName}`
                      : '–',
                },
                {
                  title: t('common.labels.date'),
                  dataIndex: 'createdAt',
                  render: (d: string) =>
                    d ? new Date(d).toLocaleDateString() : '–',
                },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title={t('dashboard.recordsChart.title')}
            loading={chartQuery.isLoading}
          >
            <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
              {chartData.map(({ date, count }) => (
                <div key={date} className="flex items-center gap-2">
                  <Typography.Text className="w-24 text-xs">
                    {new Date(date).toLocaleDateString(dateLocale, {
                      day: '2-digit',
                      month: '2-digit',
                    })}
                  </Typography.Text>
                  <div
                    className="flex-1 h-6 bg-slate-100 rounded overflow-hidden"
                    title={t('dashboard.recordsChart.barTooltip', { count })}
                  >
                    <div
                      className="h-full bg-blue-500 rounded"
                      style={{
                        width: `${
                          Math.max(
                            0,
                            Math.min(
                              100,
                              (count /
                                Math.max(
                                  1,
                                  ...chartData.map((c) => c.count),
                                )) *
                                100,
                            ),
                          )
                        }%`,
                      }}
                    />
                  </div>
                  <Typography.Text className="w-8 text-xs">
                    {count}
                  </Typography.Text>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
