import { useQuery } from '@tanstack/react-query';
import { Button, Select, Space, Table, Tag, Typography } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { installationRecordsApi } from '@/api/installation-records.api';
import { getApiErrorMessage } from '@/utils/error.utils';
import type {
  InstallationRecordItem,
  InstallationRecordsListParams,
  RecordStatus,
} from '@/types/installation-record.types';

const statusFilterOptions = [
  { label: 'Svi statusi', value: '' },
  { label: 'Nacrt', value: 'DRAFT' },
  { label: 'Poslano', value: 'SENT' },
  { label: 'Greška slanja', value: 'SEND_FAILED' },
  { label: 'SEP aktiviran', value: 'SEP_ACTIVATED' },
  { label: 'Legacy završeno', value: 'LEGACY_COMPLETED' },
];

const statusColor: Record<string, string> = {
  DRAFT: 'default',
  SENT: 'blue',
  SEND_FAILED: 'error',
  SEP_ACTIVATED: 'success',
  LEGACY_COMPLETED: 'default',
};

const statusLabel: Record<string, string> = {
  DRAFT: 'Nacrt',
  SENT: 'Poslano',
  SEND_FAILED: 'Greška slanja',
  SEP_ACTIVATED: 'SEP aktiviran',
  LEGACY_COMPLETED: 'Legacy završeno',
};

const defaultFilters: InstallationRecordsListParams = {
  page: 1,
  limit: 20,
};

export default function InstallationRecordsListPage() {
  const navigate = useNavigate();
  const [filters, setFilters] =
    useState<InstallationRecordsListParams>(defaultFilters);

  const listQuery = useQuery({
    queryKey: ['installation-records', 'list', filters],
    queryFn: () =>
      installationRecordsApi.list({
        page: filters.page,
        limit: filters.limit,
        status: filters.status,
      }),
  });

  const rows = listQuery.data?.items ?? [];

  return (
    <div
      className="space-y-4"
      data-tour-id="admin-records"
      data-tour-role="SYSTEM_ADMIN DIST_ADMIN"
    >
      <div
        className="flex flex-wrap items-center justify-between gap-4"
        data-tour-id="records-header"
      >
        <Typography.Title level={3} className="!mb-0">
          Zapisnici ugradnje
        </Typography.Title>
        <Button type="primary" onClick={() => navigate('/installation-records/new')}>
          Novi zapisnik
        </Button>
      </div>

      <Space
        wrap
        data-tour-id="records-filters"
      >
        <Select
          placeholder="Status"
          allowClear
          style={{ width: 180 }}
          value={filters.status ?? ''}
          onChange={(value) =>
            setFilters((prev) => ({
              ...prev,
              page: 1,
              status: (value as RecordStatus) || undefined,
            }))
          }
          options={statusFilterOptions}
        />
        <Button
          onClick={() => setFilters(defaultFilters)}
        >
          Reset filtera
        </Button>
      </Space>

      {listQuery.isError && (
        <Typography.Text type="danger">
          {getApiErrorMessage(listQuery.error, 'Učitavanje liste nije uspjelo.')}
        </Typography.Text>
      )}

      <Table<InstallationRecordItem>
        rowKey="id"
        loading={listQuery.isLoading}
        dataSource={rows}
        pagination={{
          current: listQuery.data?.page,
          pageSize: listQuery.data?.limit,
          total: listQuery.data?.total,
          showSizeChanger: true,
          showTotal: (total) => `Ukupno: ${total}`,
          onChange: (page, pageSize) =>
            setFilters((prev) => ({ ...prev, page, limit: pageSize ?? 20 })),
        }}
        columns={[
          {
            title: 'Broj zapisnika',
            dataIndex: 'recordNumber',
            key: 'recordNumber',
            render: (_, row) => (
              <Button
                type="link"
                className="p-0"
                onClick={() => navigate(`/installation-records/${row.id}`)}
              >
                {row.recordNumber}
              </Button>
            ),
          },
          {
            title: 'ICCID',
            key: 'iccid',
            render: (_, row) => row.meter?.simCard?.iccid ?? '–',
          },
          {
            title: 'Brojilo',
            key: 'meter',
            render: (_, row) =>
              row.meter
                ? `${row.meter.serialNumber}${row.meter.meterTypeDefinition ? ` (${row.meter.meterTypeDefinition.name})` : ''}`
                : '–',
          },
          {
            title: 'Adresa / Lokacija',
            key: 'address',
            ellipsis: true,
            render: (_, row) =>
              row.meter?.installationAddress ||
              [row.meter?.city, row.meter?.municipality].filter(Boolean).join(', ') ||
              '–',
          },
          {
            title: 'Datum ugradnje',
            key: 'installationDate',
            render: (_, row) =>
              row.meter?.installationDate
                ? new Date(row.meter.installationDate).toLocaleDateString()
                : '–',
          },
          {
            title: 'Instalirao',
            key: 'installedBy',
            render: (_, row) =>
              row.installedBy
                ? `${row.installedBy.firstName} ${row.installedBy.lastName}`
                : '–',
          },
          {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status: RecordStatus) => (
              <Tag color={statusColor[status] ?? 'default'}>
                {statusLabel[status] ?? status}
              </Tag>
            ),
          },
        ]}
      />
    </div>
  );
}
