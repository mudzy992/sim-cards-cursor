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
import { useTranslation } from '@/i18n';

const statusColor: Record<string, string> = {
  DRAFT: 'default',
  SENT: 'blue',
  SEND_FAILED: 'error',
  SEP_ACTIVATED: 'success',
  LEGACY_COMPLETED: 'default',
};

const statusLabelKey: Record<string, string> = {
  DRAFT: 'installationRecords.status.draft',
  SENT: 'installationRecords.status.sent',
  SEND_FAILED: 'installationRecords.status.sendFailed',
  SEP_ACTIVATED: 'installationRecords.status.sepActivated',
  LEGACY_COMPLETED: 'installationRecords.status.legacyCompleted',
};

const defaultFilters: InstallationRecordsListParams = {
  page: 1,
  limit: 20,
};

export default function InstallationRecordsListPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [filters, setFilters] =
    useState<InstallationRecordsListParams>(defaultFilters);

  const statusFilterOptions = [
    { label: t('common.labels.all'), value: '' },
    { label: t('installationRecords.status.draft'), value: 'DRAFT' },
    { label: t('installationRecords.status.sent'), value: 'SENT' },
    { label: t('installationRecords.status.sendFailed'), value: 'SEND_FAILED' },
    { label: t('installationRecords.status.sepActivated'), value: 'SEP_ACTIVATED' },
    { label: t('installationRecords.status.legacyCompleted'), value: 'LEGACY_COMPLETED' },
  ];

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
          {t('installationRecords.list.title')}
        </Typography.Title>
        <Button type="primary" onClick={() => navigate('/installation-records/new')}>
          {t('installationRecords.list.newRecord')}
        </Button>
      </div>

      <Space
        wrap
        data-tour-id="records-filters"
      >
        <Select
          placeholder={t('common.labels.status')}
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
          {t('common.actions.clearFilters')}
        </Button>
      </Space>

      {listQuery.isError && (
        <Typography.Text type="danger">
          {getApiErrorMessage(listQuery.error, t('installationRecords.list.loadFailed'))}
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
          showTotal: (total) => t('common.pagination.totalItems', { count: total }),
          onChange: (page, pageSize) =>
            setFilters((prev) => ({ ...prev, page, limit: pageSize ?? 20 })),
        }}
        columns={[
          {
            title: t('installationRecords.list.columns.recordNumber'),
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
            title: t('layout.sidebar.meters'),
            key: 'meter',
            render: (_, row) =>
              row.meter
                ? `${row.meter.serialNumber}${row.meter.meterTypeDefinition ? ` (${row.meter.meterTypeDefinition.name})` : ''}`
                : '–',
          },
          {
            title: t('installationRecords.list.columns.address'),
            key: 'address',
            ellipsis: true,
            render: (_, row) =>
              row.meter?.installationAddress ||
              [row.meter?.city, row.meter?.municipality].filter(Boolean).join(', ') ||
              '–',
          },
          {
            title: t('installationRecords.list.columns.installationDate'),
            key: 'installationDate',
            render: (_, row) =>
              row.meter?.installationDate
                ? new Date(row.meter.installationDate).toLocaleDateString()
                : '–',
          },
          {
            title: t('installationRecords.list.columns.installedBy'),
            key: 'installedBy',
            render: (_, row) =>
              row.installedBy
                ? `${row.installedBy.firstName} ${row.installedBy.lastName}`
                : '–',
          },
          {
            title: t('common.labels.status'),
            dataIndex: 'status',
            key: 'status',
            render: (status: RecordStatus) => (
              <Tag color={statusColor[status] ?? 'default'}>
                {statusLabelKey[status] ? t(statusLabelKey[status]) : status}
              </Tag>
            ),
          },
        ]}
      />
    </div>
  );
}
