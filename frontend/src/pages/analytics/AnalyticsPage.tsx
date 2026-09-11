import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Button,
  Card,
  Col,
  Row,
  Segmented,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import {
  analyticsApi,
  type AnalyticsRange,
  type TimeRangeParams,
} from '@/api/analytics.api';
import { useTranslation } from '@/i18n';
import { getSimCardStatusLabel } from '@/utils/labels.utils'
import type { SimCardStatus } from '@/types/sim-card.types'

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
  const dateLocale = language === 'bs' ? 'bs-BA' : 'en-US';
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Typography.Title level={3} className="!mb-0">
          {t('layout.sidebar.analytics')}
        </Typography.Title>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
          <Typography.Text type="secondary" className="text-xs sm:text-sm">
            {t('analytics.timeRangeLabel')}
          </Typography.Text>
          <Segmented
            options={rangeOptions}
            value={rangeParams.range ?? '30_DAYS'}
            onChange={(v) => setRangeRange(v as AnalyticsRange)}
          />
        </div>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card
            title={t('analytics.overviewCardTitle')}
            loading={overviewQuery.isLoading}
            extra={
              <Button size="small" onClick={() => void handleDownloadCsv('overview')}>
                CSV
              </Button>
            }
          >
            <div className="space-y-2 text-sm">
              <div>
                <Typography.Text strong>{t('analytics.recordsTotal')}: </Typography.Text>
                <Typography.Text>
                  {overview?.installationRecords.total ?? 0}
                </Typography.Text>
              </div>
              <div>
                <Typography.Text strong>{t('analytics.simCardsTotal')}: </Typography.Text>
                <Typography.Text>{overview?.simCards.total ?? 0}</Typography.Text>
              </div>
              <div>
                <Typography.Text strong>{t('layout.sidebar.meters')}: </Typography.Text>
                <Typography.Text>{overview?.metersTotal ?? 0}</Typography.Text>
              </div>
              <div className="mt-2">
                <Typography.Text strong>{t('analytics.activationSpeed')}</Typography.Text>
                <div className="grid grid-cols-2 gap-x-4 text-xs mt-1">
                  <span>{t('analytics.sampleCount')}</span>
                  <span>{overview?.activationKpi.count ?? 0}</span>
                  <span>{t('analytics.average')}</span>
                  <span>{overview?.activationKpi.avgSeconds?.toFixed(0) ?? '–'}</span>
                  <span>{t('analytics.median')}</span>
                  <span>{overview?.activationKpi.p50Seconds?.toFixed(0) ?? '–'}</span>
                  <span>p90:</span>
                  <span>{overview?.activationKpi.p90Seconds?.toFixed(0) ?? '–'}</span>
                </div>
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            title={t('analytics.simByStatusTitle')}
            loading={simQuery.isLoading}
            extra={
              <Button size="small" onClick={() => void handleDownloadCsv('sim-cards')}>
                CSV
              </Button>
            }
          >
            <div className="space-y-2">
              {sim?.byStatus &&
                Object.entries(sim.byStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center gap-2 text-xs">
                    <span className="w-28">{getSimCardStatusLabel(status as SimCardStatus, t)}</span>
                    <div className="flex-1 h-3 bg-slate-100 rounded">
                      <div
                        className="h-full bg-emerald-500 rounded"
                        style={{
                          width: `${Math.min(
                            100,
                            (count /
                              Math.max(
                                1,
                                ...Object.values(sim.byStatus ?? {}).map((c) => c ?? 0),
                              )) *
                              100,
                          )}%`,
                        }}
                      />
                    </div>
                    <span className="w-8 text-right">{count}</span>
                  </div>
                ))}
              {!sim?.byStatus && (
                <Typography.Text type="secondary" className="text-xs">
                  {t('common.states.noData')}
                </Typography.Text>
              )}
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            title={t('analytics.recordsFunnelTitle')}
            loading={recordsQuery.isLoading}
            extra={
              <Button
                size="small"
                onClick={() => void handleDownloadCsv('installation-records')}
              >
                CSV
              </Button>
            }
          >
            <div className="space-y-2">
              {records?.funnel &&
                Object.entries(records.funnel).map(([status, count]) => (
                  <div key={status} className="flex items-center gap-2 text-xs">
                    <span className="w-32">
                      {statusLabelKey[status] ? t(statusLabelKey[status]) : status}
                    </span>
                    <div className="flex-1 h-3 bg-slate-100 rounded">
                      <div
                        className="h-full bg-sky-500 rounded"
                        style={{
                          width: `${Math.min(
                            100,
                            (count /
                              Math.max(
                                1,
                                ...Object.values(records.funnel ?? {}).map(
                                  (c) => c ?? 0,
                                ),
                              )) *
                              100,
                          )}%`,
                        }}
                      />
                    </div>
                    <span className="w-8 text-right">{count}</span>
                  </div>
                ))}
              {!records?.funnel && (
                <Typography.Text type="secondary" className="text-xs">
                  {t('common.states.noData')}
                </Typography.Text>
              )}
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title={t('analytics.simByDistributionTitle')} loading={simQuery.isLoading}>
            <div className="-mx-4 overflow-x-auto px-4">
              <Table
                dataSource={sim?.byDistribution ?? []}
                rowKey="distributionId"
                size="small"
                pagination={false}
                scroll={{ x: 'max-content' }}
                columns={[
                  { title: t('analytics.distributionColumn'), dataIndex: 'distributionName' },
                  { title: t('layout.sidebar.simCards'), dataIndex: 'total' },
                ]}
              />
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title={t('analytics.simByBranchTitle')} loading={simQuery.isLoading}>
            <div className="-mx-4 overflow-x-auto px-4">
              <Table
                dataSource={sim?.byBranch ?? []}
                rowKey="branchId"
                size="small"
                pagination={false}
                scroll={{ x: 'max-content' }}
                columns={[
                  { title: t('analytics.distributionColumn'), dataIndex: 'distributionName' },
                  { title: t('analytics.branchColumn'), dataIndex: 'branchName' },
                  { title: t('analytics.installedSimColumn'), dataIndex: 'installedCount' },
                ]}
              />
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24}>
          <Card title={t('analytics.simByOperatorTitle')} loading={simQuery.isLoading}>
            <div className="-mx-4 overflow-x-auto px-4">
              <Table
                dataSource={sim?.byOperator ?? []}
                rowKey="userId"
                size="small"
                pagination={false}
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
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title={t('analytics.timelineTitle')} loading={recordsQuery.isLoading}>
            <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
              {records?.timeline.map(({ date, count }) => (
                <div key={date} className="flex items-center gap-2">
                  <Typography.Text className="w-24 text-xs">
                    {new Date(date).toLocaleDateString(dateLocale, {
                      day: '2-digit',
                      month: '2-digit',
                    })}
                  </Typography.Text>
                  <div className="flex-1 h-4 bg-slate-100 rounded overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded"
                      style={{
                        width: `${Math.min(
                          100,
                          (count /
                            Math.max(
                              1,
                              ...records.timeline.map((c) => c.count ?? 0),
                            )) *
                            100,
                        )}%`,
                      }}
                    />
                  </div>
                  <Typography.Text className="w-8 text-xs text-right">
                    {count}
                  </Typography.Text>
                </div>
              ))}
              {!records?.timeline?.length && (
                <Typography.Text type="secondary" className="text-xs">
                  {t('analytics.noDataForRange')}
                </Typography.Text>
              )}
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title={t('analytics.userActivityTitle')}
            loading={usersQuery.isLoading}
            extra={
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
                    render: (r: string) => <Tag>{r}</Tag>,
                  },
                  { title: t('analytics.createdRecordsColumn'), dataIndex: 'created' },
                  { title: t('analytics.approvedRecordsColumn'), dataIndex: 'approved' },
                ]}
              />
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

