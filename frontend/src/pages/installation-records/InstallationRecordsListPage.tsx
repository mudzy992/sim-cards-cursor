import { useQuery } from '@tanstack/react-query';
import { Button, Input, Select, Table } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { branchesApi } from '@/api/branches.api';
import { installationRecordsApi } from '@/api/installation-records.api';
import { useAuthStore } from '@/store/auth.store';
import { getApiErrorMessage } from '@/utils/error.utils';
import type {
  InstallationRecordItem,
  InstallationRecordsListParams,
  RecordStatus,
} from '@/types/installation-record.types';
import { useTranslation } from '@/i18n';
import {
  EmptyNotice,
  ErrorNotice,
  FilterBar,
  PageHeader,
  PageShell,
  StatusBadge,
  getRecordStatusTone,
} from '@/components/ui';

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
  const user = useAuthStore((s) => s.user);
  const canFilterByBranch = user?.role === 'SYSTEM_ADMIN' || user?.role === 'DIST_ADMIN';
  const [searchInput, setSearchInput] = useState('');
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

  const branchesQuery = useQuery({
    queryKey: ['branches', 'list', user?.distributionId ?? 'all'],
    queryFn: () => branchesApi.list(user?.role === 'DIST_ADMIN' ? user.distributionId ?? undefined : undefined),
    enabled: canFilterByBranch,
  });

  const listQuery = useQuery({
    queryKey: ['installation-records', 'list', filters],
    queryFn: () =>
      installationRecordsApi.list({
        page: filters.page,
        limit: filters.limit,
        status: filters.status,
        branchId: filters.branchId,
        search: filters.search,
      }),
  });

  const rows = listQuery.data?.items ?? [];

  return (
    <PageShell>
      <div
        className="space-y-4"
        data-tour-id="admin-records"
        data-tour-role="SYSTEM_ADMIN DIST_ADMIN"
      >
        <div data-tour-id="records-header">
          <PageHeader
            title={t('installationRecords.list.title')}
            actions={
              <Button type="primary" onClick={() => navigate('/installation-records/new')}>
                {t('installationRecords.list.newRecord')}
              </Button>
            }
          />
        </div>

        <FilterBar
          hasActiveFilters={Boolean(filters.status || filters.branchId || filters.search)}
          onReset={() => {
            setSearchInput('');
            setFilters(defaultFilters);
          }}
        >
          <div className="flex flex-wrap items-center gap-3" data-tour-id="records-filters">
            <Input.Search
              allowClear
              placeholder={t('installationRecords.list.searchPlaceholder')}
              style={{ width: 280 }}
              value={searchInput}
              onChange={(e) => {
                const value = e.target.value;
                setSearchInput(value);
                if (!value) {
                  setFilters((prev) => ({
                    ...prev,
                    page: 1,
                    search: undefined,
                  }));
                }
              }}
              onSearch={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  page: 1,
                  search: value.trim() || undefined,
                }))
              }
            />
            <Select
              placeholder={t('common.labels.status')}
              allowClear
              style={{ width: 200 }}
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
            {canFilterByBranch ? (
              <Select
                placeholder={t('installationRecords.list.branchPlaceholder')}
                allowClear
                showSearch
                optionFilterProp="label"
                loading={branchesQuery.isLoading}
                style={{ width: 220 }}
                value={filters.branchId ?? undefined}
                onChange={(value) =>
                  setFilters((prev) => ({
                    ...prev,
                    page: 1,
                    branchId: value || undefined,
                  }))
                }
                options={(branchesQuery.data ?? []).map((b) => ({
                  label: `${b.name} (${b.code})`,
                  value: b.id,
                }))}
              />
            ) : null}
          </div>
        </FilterBar>

        {listQuery.isError ? (
          <ErrorNotice
            message={getApiErrorMessage(listQuery.error, t('installationRecords.list.loadFailed'))}
            onRetry={() => void listQuery.refetch()}
          />
        ) : null}

        <Table<InstallationRecordItem>
          rowKey="id"
          loading={listQuery.isLoading}
          dataSource={rows}
          locale={{ emptyText: <EmptyNotice /> }}
          scroll={{ x: 980 }}
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
              width: 160,
              render: (_, row) => (
                <Button
                  type="link"
                  className="p-0 font-mono"
                  onClick={() => navigate(`/installation-records/${row.id}`)}
                >
                  {row.recordNumber}
                </Button>
              ),
            },
            {
              title: 'ICCID',
              key: 'iccid',
              width: 200,
              render: (_, row) => row.meter?.simCard?.iccid ?? '–',
            },
            {
              title: t('layout.sidebar.meters'),
              key: 'meter',
              width: 190,
              render: (_, row) =>
                row.meter
                  ? `${row.meter.serialNumber}${row.meter.meterTypeDefinition ? ` (${row.meter.meterTypeDefinition.name})` : ''}`
                  : '–',
            },
            {
              title: t('installationRecords.list.columns.address'),
              key: 'address',
              width: 240,
              ellipsis: { showTitle: true },
              render: (_, row) =>
                row.meter?.installationAddress ||
                [row.meter?.city, row.meter?.municipality].filter(Boolean).join(', ') ||
                '–',
            },
            {
              title: t('installationRecords.list.columns.installationDate'),
              key: 'installationDate',
              width: 140,
              render: (_, row) =>
                row.meter?.installationDate
                  ? new Date(row.meter.installationDate).toLocaleDateString()
                  : '–',
            },
            {
              title: t('installationRecords.list.columns.installedBy'),
              key: 'installedBy',
              width: 160,
              render: (_, row) =>
                row.installedBy
                  ? `${row.installedBy.firstName} ${row.installedBy.lastName}`
                  : '–',
            },
            {
              title: t('common.labels.status'),
              dataIndex: 'status',
              key: 'status',
              width: 150,
              render: (status: RecordStatus) => (
                <StatusBadge
                  tone={getRecordStatusTone(status)}
                  label={statusLabelKey[status] ? t(statusLabelKey[status]) : status}
                />
              ),
            },
          ]}
        />
      </div>
    </PageShell>
  );
}
