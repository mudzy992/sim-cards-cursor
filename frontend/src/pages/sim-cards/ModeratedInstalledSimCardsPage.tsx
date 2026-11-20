import { useQuery } from '@tanstack/react-query';
import { Button, Input, Table } from 'antd';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { simCardsApi } from '@/api/sim-cards.api';
import type {
  ModeratedInstalledSimCardItem,
  SimCardListParams,
  SimCardStatus,
} from '@/types/sim-card.types';
import { getSimCardStatusLabel } from '@/utils/labels.utils';
import { useTranslation } from '@/i18n';
import {
  EmptyNotice,
  ErrorNotice,
  FilterBar,
  PageHeader,
  PageShell,
  StatusBadge,
  getSimCardStatusTone,
} from '@/components/ui';
import { DEFAULT_PAGE_SIZE, FALLBACK_DASH } from '@/constants/ui';
import { ROUTES } from '@/config/routes';
import { formatDateTime } from '@/utils/formatters';

export default function ModeratedInstalledSimCardsPage() {
  const navigate = useNavigate();
  const { t, language } = useTranslation();
  const [filters, setFilters] = useState<SimCardListParams>({
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
  });
  const [searchInput, setSearchInput] = useState('');

  const query = useQuery({
    queryKey: ['sim-cards', 'moderated-installed', filters],
    queryFn: () => simCardsApi.moderatedInstalled(filters),
  });

  const rows = query.data?.items ?? [];

  const handleReset = () => {
    setSearchInput('');
    setFilters({ page: 1, limit: DEFAULT_PAGE_SIZE });
  };

  const columns = useMemo(
    () => [
      {
        title: 'ICCID',
        key: 'iccid',
        render: (_: unknown, row: ModeratedInstalledSimCardItem) => (
          <Button
            type="link"
            onClick={() => navigate(ROUTES.simCardDetail(row.id))}
            className="p-0 font-mono"
          >
            {row.iccid}
          </Button>
        ),
      },
      { title: 'IP', dataIndex: 'ipAddress', key: 'ipAddress' },
      {
        title: t('simCards.list.columns.branch'),
        key: 'branch',
        render: (_: unknown, row: ModeratedInstalledSimCardItem) => {
          const b = row.meter?.branch;
          if (!b) return FALLBACK_DASH;
          return `${b.name} (${b.code})`;
        },
      },
      {
        title: t('layout.sidebar.meters'),
        key: 'meterSerial',
        render: (_: unknown, row: ModeratedInstalledSimCardItem) =>
          row.meter?.serialNumber ?? FALLBACK_DASH,
      },
      {
        title: t('simCards.details.assignedTo'),
        key: 'assignedTo',
        render: (_: unknown, row: ModeratedInstalledSimCardItem) =>
          row.assignedTo
            ? `${row.assignedTo.firstName} ${row.assignedTo.lastName}`
            : FALLBACK_DASH,
      },
      {
        title: t('simCards.list.columns.installedAt'),
        key: 'installedAt',
        width: 180,
        render: (_: unknown, row: ModeratedInstalledSimCardItem) =>
          formatDateTime(row.installedAt, language),
      },
      {
        title: t('common.labels.status'),
        key: 'status',
        width: 150,
        render: (_: unknown, row: ModeratedInstalledSimCardItem) => (
          <StatusBadge
            tone={getSimCardStatusTone(row.status)}
            label={getSimCardStatusLabel(row.status as SimCardStatus, t)}
          />
        ),
      },
    ],
    [navigate, t, language],
  );

  return (
    <PageShell>
      <div className="space-y-4" data-tour-id="moderator-installed-sims">
        <PageHeader
          title={t('simCards.list.titleInstalled')}
          subtitle={t('simCards.list.subtitleInstalled')}
        />

        <FilterBar hasActiveFilters={Boolean(filters.search)} onReset={handleReset}>
          <Input.Search
            allowClear
            placeholder={t('simCards.list.searchPlaceholder')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onSearch={(value) =>
              setFilters((prev) => ({
                ...prev,
                page: 1,
                search: value.trim() || undefined,
              }))
            }
            className="w-72"
          />
        </FilterBar>

        {query.isError ? (
          <ErrorNotice
            message={
              (query.error as { response?: { data?: { message?: string } } })?.response?.data
                ?.message ?? t('simCards.list.loadFailed')
            }
            onRetry={() => void query.refetch()}
          />
        ) : null}

        <div className="-mx-4 overflow-x-auto px-4">
          <Table<ModeratedInstalledSimCardItem>
            rowKey="id"
            loading={query.isLoading}
            dataSource={rows}
            locale={{ emptyText: <EmptyNotice /> }}
            pagination={{
              current: query.data?.page,
              pageSize: query.data?.limit,
              total: query.data?.total,
              showSizeChanger: true,
              showTotal: (total) => t('common.pagination.totalItems', { count: total }),
              onChange: (page, pageSize) =>
                setFilters((prev) => ({
                  ...prev,
                  page,
                  limit: pageSize ?? DEFAULT_PAGE_SIZE,
                })),
            }}
            columns={columns}
            scroll={{ x: 'max-content' }}
          />
        </div>
      </div>
    </PageShell>
  );
}
