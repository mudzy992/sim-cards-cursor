import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input, Table, Typography } from 'antd';
import { activityLogApi } from '@/api/activity-log.api';
import { useTranslation } from '@/i18n';
import { EmptyNotice, FilterBar, PageHeader, PageShell, SectionCard } from '@/components/ui';

export default function ActivityLogPage() {
  const { t, language } = useTranslation();
  const dateLocale = language === 'bs' ? 'bs-BA' : 'en-US';
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['activity-log', page, limit, actionFilter, entityFilter],
    queryFn: () =>
      activityLogApi.list({
        page,
        limit,
        action: actionFilter || undefined,
        entity: entityFilter || undefined,
      }),
  });

  return (
    <PageShell>
      <div
        className="space-y-4"
        data-tour-id="admin-activity-log"
        data-tour-role="SYSTEM_ADMIN DIST_ADMIN"
      >
        <PageHeader title={t('layout.sidebar.activityLog')} />

        <FilterBar
          hasActiveFilters={Boolean(actionFilter || entityFilter)}
          onReset={() => {
            setActionFilter('');
            setEntityFilter('');
            setPage(1);
          }}
        >
          <Input
            placeholder={t('activityLog.filters.actionPlaceholder')}
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            allowClear
            style={{ width: 220 }}
          />
          <Input
            placeholder={t('activityLog.filters.entityPlaceholder')}
            value={entityFilter}
            onChange={(e) => {
              setEntityFilter(e.target.value);
              setPage(1);
            }}
            allowClear
            style={{ width: 220 }}
          />
        </FilterBar>

        <SectionCard>
          <Table
            dataSource={data?.items ?? []}
            rowKey="id"
            loading={isLoading}
            locale={{ emptyText: <EmptyNotice /> }}
            pagination={{
              current: page,
              pageSize: limit,
              total: data?.total ?? 0,
              showSizeChanger: false,
              onChange: setPage,
            }}
            columns={[
              {
                title: t('common.labels.date'),
                dataIndex: 'createdAt',
                width: 180,
                render: (d: string) =>
                  d ? new Date(d).toLocaleString(dateLocale) : '–',
              },
              { title: t('activityLog.columns.action'), dataIndex: 'action', width: 120 },
              { title: t('activityLog.columns.entity'), dataIndex: 'entity', width: 160 },
              {
                title: t('activityLog.columns.user'),
                render: (_: unknown, row: { user?: { firstName: string; lastName: string } }) =>
                  row.user
                    ? `${row.user.firstName} ${row.user.lastName}`
                    : '–',
              },
              {
                title: t('activityLog.columns.details'),
                dataIndex: 'details',
                render: (d: unknown) =>
                  d && typeof d === 'object' ? (
                    <Typography.Text type="secondary" className="block max-w-md break-all text-xs">
                      {JSON.stringify(d)}
                    </Typography.Text>
                  ) : (
                    '–'
                  ),
              },
            ]}
          />
        </SectionCard>
      </div>
    </PageShell>
  );
}
