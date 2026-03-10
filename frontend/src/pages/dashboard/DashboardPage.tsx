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

const statusLabel: Record<string, string> = {
  DRAFT: 'Nacrt',
  PENDING: 'Čeka odobrenje',
  SUBMIT_FAILED: 'Greška slanja',
  REJECTED: 'Odbijeno',
  WAITING_SEP_ACTIVATION: 'Čeka SEP',
  ACTIVATED_IN_SEP: 'Aktivirano u SEP',
  SENT: 'Poslano',
};

const statusColor: Record<string, string> = {
  DRAFT: 'default',
  PENDING: 'processing',
  SUBMIT_FAILED: 'error',
  REJECTED: 'error',
  WAITING_SEP_ACTIVATION: 'warning',
  ACTIVATED_IN_SEP: 'success',
  SENT: 'blue',
};

export default function DashboardPage() {
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

  return (
    <div
      className="space-y-6"
      data-tour-id="admin-dashboard"
      data-tour-role="SYSTEM_ADMIN MODERATOR"
    >
      <Typography.Title level={3} className="!mb-0">
        Dashboard
      </Typography.Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Zapisnici (ukupno)"
              value={stats?.installationRecords?.total ?? 0}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="SIM kartice"
              value={stats?.simCards?.total ?? 0}
              prefix={<InboxOutlined />}
            />
            <Typography.Text type="secondary" className="text-xs">
              Dostupno: {stats?.simCards?.available ?? 0} | Instalirano:{' '}
              {stats?.simCards?.installed ?? 0}
            </Typography.Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Brojila"
              value={stats?.meters ?? 0}
              prefix={<ThunderboltOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <div className="space-y-1">
              <Typography.Text strong>Zapisnici po statusu</Typography.Text>
              <div className="flex flex-wrap gap-2 mt-2">
                {stats?.installationRecords?.byStatus &&
                  Object.entries(stats.installationRecords.byStatus).map(
                    ([status, count]) => (
                      <Tag key={status} color={statusColor[status] ?? 'default'}>
                        {statusLabel[status] ?? status}: {count}
                      </Tag>
                    ),
                  )}
                {(!stats?.installationRecords?.byStatus ||
                  Object.keys(stats.installationRecords.byStatus).length === 0) && (
                  <Typography.Text type="secondary">Nema podataka</Typography.Text>
                )}
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card
            title="Nedavni zapisnici"
            loading={recentQuery.isLoading}
            extra={
              <Link to="/installation-records">Svi zapisnici</Link>
            }
          >
            <Table
              dataSource={recent}
              rowKey="id"
              size="small"
              pagination={false}
              columns={[
                {
                  title: 'Broj',
                  dataIndex: 'recordNumber',
                  render: (val: string, row: RecentRecord) => (
                    <Link to={`/installation-records/${row.id}`}>{val}</Link>
                  ),
                },
                {
                  title: 'Status',
                  dataIndex: 'status',
                  render: (s: string) => (
                    <Tag color={statusColor[s]}>{statusLabel[s] ?? s}</Tag>
                  ),
                },
                {
                  title: 'Brojilo',
                  render: (_: unknown, row: RecentRecord) =>
                    row.meter?.serialNumber ?? '–',
                },
                {
                  title: 'Instalirao',
                  render: (_: unknown, row: RecentRecord) =>
                    row.installedBy
                      ? `${row.installedBy.firstName} ${row.installedBy.lastName}`
                      : '–',
                },
                {
                  title: 'Datum',
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
            title="Zapisnici po danima (30 dana)"
            loading={chartQuery.isLoading}
          >
            <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
              {chartData.map(({ date, count }) => (
                <div key={date} className="flex items-center gap-2">
                  <Typography.Text className="w-24 text-xs">
                    {new Date(date).toLocaleDateString('bs-BA', {
                      day: '2-digit',
                      month: '2-digit',
                    })}
                  </Typography.Text>
                  <div
                    className="flex-1 h-6 bg-slate-100 rounded overflow-hidden"
                    title={`${count} zapisnika`}
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
