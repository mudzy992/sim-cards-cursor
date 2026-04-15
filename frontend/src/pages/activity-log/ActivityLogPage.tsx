import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Input, Table, Typography } from 'antd';
import { activityLogApi } from '@/api/activity-log.api';

export default function ActivityLogPage() {
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
    <div
      className="space-y-4"
      data-tour-id="admin-activity-log"
      data-tour-role="SYSTEM_ADMIN DIST_ADMIN"
    >
      <Typography.Title level={3} className="!mb-0">
        Dnevnik aktivnosti
      </Typography.Title>
      <Card>
        <div className="flex gap-4 mb-4">
          <Input
            placeholder="Filter po akciji"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            allowClear
            style={{ width: 200 }}
          />
          <Input
            placeholder="Filter po entitetu"
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            allowClear
            style={{ width: 200 }}
          />
        </div>
        <Table
          dataSource={data?.items ?? []}
          rowKey="id"
          loading={isLoading}
          pagination={{
            current: page,
            pageSize: limit,
            total: data?.total ?? 0,
            showSizeChanger: false,
            onChange: setPage,
          }}
          columns={[
            {
              title: 'Datum',
              dataIndex: 'createdAt',
              width: 180,
              render: (d: string) =>
                d ? new Date(d).toLocaleString() : '–',
            },
            { title: 'Akcija', dataIndex: 'action', width: 120 },
            { title: 'Entitet', dataIndex: 'entity', width: 160 },
            {
              title: 'Korisnik',
              render: (_: unknown, row: { user?: { firstName: string; lastName: string } }) =>
                row.user
                  ? `${row.user.firstName} ${row.user.lastName}`
                  : '–',
            },
            {
              title: 'Detalji',
              dataIndex: 'details',
              render: (d: unknown) =>
                d && typeof d === 'object' ? (
                  <Typography.Text type="secondary" className="text-xs">
                    {JSON.stringify(d)}
                  </Typography.Text>
                ) : (
                  '–'
                ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
