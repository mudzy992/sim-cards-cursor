import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Drawer,
  Input,
  Select,
  Space,
  Table,
  Tabs,
  message,
} from 'antd';
import { useMemo, useState } from 'react';
import {
  InboxOutlined,
  CreditCardOutlined,
  PlusOutlined,
  PrinterOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { shipmentsApi } from '@/api/shipments.api';
import { simCardsApi } from '@/api/sim-cards.api';
import { usersApi } from '@/api/users.api';
import { useAuthStore } from '@/store/auth.store';
import { getSimCardStatusLabel } from '@/utils/labels.utils';
import type { ShipmentItem, ShipmentStatus } from '@/types/shipment.types';
import type {
  SimCardItem,
  SimCardListParams,
  SimCardStatus,
} from '@/types/sim-card.types';
import { ShipmentDeleteButton } from './ShipmentDeleteButton';
import { useTranslation } from '@/i18n';
import {
  EmptyNotice,
  FilterBar,
  PageHeader,
  PageShell,
  StatusBadge,
  getShipmentStatusTone,
  getSimCardStatusTone,
} from '@/components/ui';
import { DEFAULT_PAGE_SIZE, FALLBACK_DASH } from '@/constants/ui';
import { ROUTES } from '@/config/routes';
import { formatDate, formatNumber } from '@/utils/formatters';

const shipmentStatusOptions: ShipmentStatus[] = [
  'RECEIVED',
  'PROCESSING',
  'COMPLETED',
];

type ShipmentListParams = {
  page: number;
  limit: number;
  search?: string;
  provider?: string;
  status?: ShipmentStatus;
};

const simStatusOptions: SimCardStatus[] = [
  'AVAILABLE',
  'ASSIGNED',
  'INSTALLED',
  'DEMOUNTED',
  'DEFECTIVE',
  'RETURNED',
  'DEACTIVATED',
];

const defaultShipmentFilters: ShipmentListParams = {
  page: 1,
  limit: DEFAULT_PAGE_SIZE,
};

export default function ShipmentsListPage() {
  const navigate = useNavigate();
  const { t, language } = useTranslation();
  const queryClient = useQueryClient();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [activeTab, setActiveTab] = useState<string>('shipments');
  const currentUserRole = useAuthStore((s) => s.user?.role);
  const canManageShipments =
    currentUserRole === 'SYSTEM_ADMIN' ||
    currentUserRole === 'DIST_ADMIN';

  const [shipmentFilters, setShipmentFilters] =
    useState<ShipmentListParams>(defaultShipmentFilters);
  const [searchInput, setSearchInput] = useState('');
  const [providerInput, setProviderInput] = useState('');

  const [simFilters, setSimFilters] = useState<SimCardListParams>({
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
  });
  const [simSearchInput, setSimSearchInput] = useState('');
  const [assignTarget, setAssignTarget] = useState<SimCardItem | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const shipmentsQuery = useQuery({
    queryKey: ['shipments', 'list', shipmentFilters],
    queryFn: () => shipmentsApi.list(shipmentFilters),
  });

  const simCardsQuery = useQuery({
    queryKey: ['sim-cards', 'list', simFilters],
    queryFn: () => simCardsApi.list(simFilters),
    enabled: activeTab === 'sim-cards',
  });

  const shipmentsForFilterQuery = useQuery({
    queryKey: ['shipments', 'list', 'for-filter'],
    queryFn: () => shipmentsApi.list({ page: 1, limit: 100 }),
    enabled: activeTab === 'sim-cards',
  });

  const usersQuery = useQuery({
    queryKey: ['users', 'list'],
    queryFn: () => usersApi.list(),
    enabled: Boolean(assignTarget),
  });

  const assignMutation = useMutation({
    mutationFn: (payload: { simCardId: string; userId: string }) =>
      simCardsApi.assign(payload.simCardId, payload.userId),
    onSuccess: async () => {
      messageApi.success(t('shipments.list.assignSuccess'));
      setAssignTarget(null);
      setSelectedUserId(null);

      await queryClient.invalidateQueries({ queryKey: ['sim-cards', 'list'] });
      await queryClient.invalidateQueries({ queryKey: ['shipments', 'list'] });
    },
    onError: () => {
      messageApi.error(t('shipments.list.assignFailed'));
    },
  });

  const unassignMutation = useMutation({
    mutationFn: (simCardId: string) => simCardsApi.unassign(simCardId),
    onSuccess: async () => {
      messageApi.success(t('shipments.list.unassignSuccess'));
      await queryClient.invalidateQueries({ queryKey: ['sim-cards', 'list'] });
      await queryClient.invalidateQueries({ queryKey: ['shipments', 'list'] });
    },
    onError: () => {
      messageApi.error(t('shipments.list.unassignFailed'));
    },
  });

  const shipmentRows = shipmentsQuery.data?.items ?? [];
  const simRows = simCardsQuery.data?.items ?? [];

  const shipmentOptions = useMemo(
    () =>
      (shipmentsForFilterQuery.data?.items ?? []).map((s) => ({
        label: s.name,
        value: s.id,
      })),
    [shipmentsForFilterQuery.data?.items],
  );

  const userOptions = useMemo(
    () =>
      (usersQuery.data?.items ?? []).map((u) => ({
        value: u.id,
        label: `${u.firstName} ${u.lastName} (${u.email})`,
      })),
    [usersQuery.data?.items],
  );

  const renderCardStatusSummary = (row: ShipmentItem) => {
    const counts = row.cardStatusCounts;

    const statuses = simStatusOptions
      .map((status) => ({
        status,
        count: counts?.[status] ?? 0,
      }))
      .filter(({ count }) => count > 0);

    const total = row._count?.simCards ?? 0;

    if (total === 0) {
      return <span className="text-xs text-fg-muted">{t('shipments.list.noCards')}</span>;
    }

    return (
      <div className="min-w-[240px]">
        <div className="mb-1 flex items-center gap-2">
          <span className="font-semibold tabular-nums text-fg-primary">
            {formatNumber(total, language)}
          </span>
          <span className="text-xs text-fg-secondary">{t('shipments.list.cardsUnit')}</span>
        </div>

        <Space size={[4, 4]} wrap>
          {statuses.map(({ status, count }) => (
            <StatusBadge
              key={status}
              tone={getSimCardStatusTone(status)}
              label={`${formatNumber(count, language)} ${getSimCardStatusLabel(status, t)}`}
            />
          ))}
        </Space>
      </div>
    );
  };

  const handleShipmentSearch = () => {
    setShipmentFilters((prev: ShipmentListParams) => ({
      ...prev,
      page: 1,
      search: searchInput.trim() || undefined,
      provider: providerInput.trim() || undefined,
    }));
  };

  const handleShipmentReset = () => {
    setSearchInput('');
    setProviderInput('');
    setShipmentFilters(defaultShipmentFilters);
  };

  const hasShipmentFilters = Boolean(
    searchInput || providerInput || shipmentFilters.search || shipmentFilters.provider || shipmentFilters.status,
  );
  const hasSimFilters = Boolean(
    simSearchInput || simFilters.search || simFilters.status || simFilters.shipmentId,
  );

  const tabItems = [
    {
      key: 'shipments',
      label: (
        <span>
          <InboxOutlined /> {t('layout.sidebar.shipments')}
        </span>
      ),
      children: (
        <div className="space-y-4">
          <div
            className="flex flex-wrap items-center justify-between gap-4"
            data-tour-id="shipments-header"
          >
            <span className="text-sm text-fg-secondary">{t('shipments.list.tabIntro')}</span>

            {canManageShipments ? (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => navigate(ROUTES.shipmentsNew)}
                data-tour-id="shipments-new-button"
              >
                {t('shipments.list.newShipment')}
              </Button>
            ) : null}
          </div>

          <FilterBar
            hasActiveFilters={hasShipmentFilters}
            onReset={handleShipmentReset}
          >
            <div className="flex flex-wrap items-center gap-3" data-tour-id="shipments-filters">
              <Input
                placeholder={t('shipments.list.searchNamePlaceholder')}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onPressEnter={handleShipmentSearch}
                className="w-56"
              />

              <Input
                placeholder={t('shipments.list.providerPlaceholder')}
                value={providerInput}
                onChange={(e) => setProviderInput(e.target.value)}
                onPressEnter={handleShipmentSearch}
                className="w-56"
              />

              <Select
                allowClear
                placeholder={t('common.labels.status')}
                className="w-40"
                value={shipmentFilters.status}
                onChange={(value) =>
                  setShipmentFilters((prev: ShipmentListParams) => ({
                    ...prev,
                    page: 1,
                    status: value,
                  }))
                }
                options={shipmentStatusOptions.map((s) => ({
                  label: s,
                  value: s,
                }))}
              />

              <Button onClick={handleShipmentSearch}>{t('common.actions.search')}</Button>
            </div>
          </FilterBar>

          <Table<ShipmentItem>
            rowKey="id"
            loading={shipmentsQuery.isLoading}
            dataSource={shipmentRows}
            locale={{ emptyText: <EmptyNotice /> }}
            pagination={{
              current: shipmentsQuery.data?.page,
              pageSize: shipmentsQuery.data?.limit,
              total: shipmentsQuery.data?.total,
              showSizeChanger: true,
              showTotal: (total) => t('common.pagination.totalItems', { count: total }),
              onChange: (page, pageSize) =>
                setShipmentFilters((prev: ShipmentListParams) => ({
                  ...prev,
                  page,
                  limit: pageSize ?? DEFAULT_PAGE_SIZE,
                })),
            }}
            columns={[
              {
                title: t('common.labels.name'),
                render: (_, row) => (
                  <Button
                    type="link"
                    onClick={() => navigate(ROUTES.shipmentDetail(row.id))}
                    className="p-0"
                  >
                    {row.name}
                  </Button>
                ),
              },
              {
                title: t('shipments.details.provider'),
                dataIndex: 'provider',
              },
              {
                title: t('shipments.details.receivedDate'),
                dataIndex: 'receivedDate',
                render: (val: string) => formatDate(val, language),
              },
              {
                title: t('shipments.list.columns.cards'),
                width: 330,
                render: (_, row) => renderCardStatusSummary(row),
              },
              {
                title: t('common.labels.status'),
                dataIndex: 'status',
                render: (status: string) => (
                  <StatusBadge tone={getShipmentStatusTone(status)} label={status} />
                ),
              },
              {
                title: t('common.actions.actions'),
                width: 240,
                render: (_: unknown, row) => (
                  <Space size={8}>
                    <Button
                      size="small"
                      icon={<PrinterOutlined />}
                      onClick={() => navigate(ROUTES.shipmentPrint(row.id))}
                    >
                      {t('shipments.list.labelsShort')}
                    </Button>

                    <ShipmentDeleteButton
                      shipment={{
                        id: row.id,
                        name: row.name,
                        simCardsCount: row._count?.simCards ?? 0,
                      }}
                      role={currentUserRole}
                    />

                    <Button
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => navigate(ROUTES.shipmentEdit(row.id))}
                    >
                      {t('common.actions.edit')}
                    </Button>
                  </Space>
                ),
              },
            ]}
            data-tour-id="shipments-table"
          />
        </div>
      ),
    },
    {
      key: 'sim-cards',
      label: (
        <span>
          <CreditCardOutlined /> {t('layout.sidebar.simCards')}
        </span>
      ),
      children: (
        <div className="space-y-4">
          <div className="text-sm text-fg-secondary">{t('shipments.list.simTabIntro')}</div>

          <FilterBar
            hasActiveFilters={hasSimFilters}
            onReset={() => {
              setSimSearchInput('');
              setSimFilters({ page: 1, limit: DEFAULT_PAGE_SIZE });
            }}
          >
            <div className="flex flex-wrap items-center gap-3" data-tour-id="shipments-sim-filters">
              <Input.Search
                allowClear
                placeholder={t('simCards.list.searchPlaceholder')}
                value={simSearchInput}
                onChange={(e) => setSimSearchInput(e.target.value)}
                onSearch={(value) =>
                  setSimFilters((prev) => ({
                    ...prev,
                    page: 1,
                    search: value.trim() || undefined,
                  }))
                }
                className="w-72"
              />

              <Select
                allowClear
                placeholder={t('common.labels.status')}
                className="w-44"
                value={simFilters.status}
                onChange={(value) =>
                  setSimFilters((prev) => ({
                    ...prev,
                    page: 1,
                    status: value,
                  }))
                }
                options={simStatusOptions.map((s) => ({
                  label: getSimCardStatusLabel(s, t),
                  value: s,
                }))}
              />

              <Select
                allowClear
                placeholder={t('shipments.details.title').split(' ')[0]}
                className="w-56"
                value={simFilters.shipmentId}
                onChange={(value) =>
                  setSimFilters((prev) => ({
                    ...prev,
                    page: 1,
                    shipmentId: value,
                  }))
                }
                options={shipmentOptions}
              />
            </div>
          </FilterBar>

          <Table<SimCardItem>
            rowKey="id"
            loading={simCardsQuery.isLoading}
            dataSource={simRows}
            locale={{ emptyText: <EmptyNotice /> }}
            pagination={{
              current: simCardsQuery.data?.page,
              pageSize: simCardsQuery.data?.limit,
              total: simCardsQuery.data?.total,
              showSizeChanger: true,
              onChange: (page, pageSize) =>
                setSimFilters((prev) => ({
                  ...prev,
                  page,
                  limit: pageSize ?? DEFAULT_PAGE_SIZE,
                })),
            }}
            columns={[
              {
                title: 'ICCID',
                render: (_, row) => (
                  <Button
                    type="link"
                    onClick={() => navigate(ROUTES.simCardDetail(row.id))}
                    className="p-0 font-mono"
                  >
                    {row.iccid}
                  </Button>
                ),
              },
              {
                title: 'IP',
                dataIndex: 'ipAddress',
              },
              {
                title: t('simCards.details.publicIp'),
                render: (_, row) => row.publicIpAddress ?? FALLBACK_DASH,
              },
              {
                title: t('common.labels.status'),
                dataIndex: 'status',
                render: (status: string) => (
                  <StatusBadge
                    tone={getSimCardStatusTone(status)}
                    label={getSimCardStatusLabel(status as SimCardStatus, t)}
                  />
                ),
              },
              {
                title: t('shipments.details.title').split(' ')[0],
                render: (_, row) => row.shipment.name,
              },
              {
                title: t('simCards.details.assignedTo'),
                render: (_, row) =>
                  row.assignedTo
                    ? `${row.assignedTo.firstName} ${row.assignedTo.lastName}`
                    : FALLBACK_DASH,
              },
              {
                title: t('common.actions.actions'),
                render: (_, row) => (
                  <Space>
                    <Button
                      size="small"
                      onClick={() => {
                        setAssignTarget(row);
                        setSelectedUserId(row.assignedTo?.id ?? null);
                      }}
                      disabled={row.status !== 'AVAILABLE'}
                    >
                      {t('shipments.list.assign')}
                    </Button>

                    <Button
                      size="small"
                      danger
                      onClick={() => void unassignMutation.mutate(row.id)}
                      disabled={row.status !== 'ASSIGNED'}
                      loading={unassignMutation.isPending}
                    >
                      {t('shipments.list.unassign')}
                    </Button>
                  </Space>
                ),
              },
            ]}
            data-tour-id="shipments-sim-table"
          />
        </div>
      ),
    },
  ];

  return (
    <PageShell>
      <div
        className="space-y-4"
        data-tour-id="admin-shipments-sim"
        data-tour-role="SYSTEM_ADMIN DIST_ADMIN"
      >
        {messageContextHolder}

        <PageHeader
          title={t('layout.sidebar.shipments')}
          subtitle={t('shipments.list.pageIntro')}
        />

        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />

        <Drawer
          title={t('shipments.list.assignDrawerTitle')}
          open={Boolean(assignTarget)}
          width={520}
          onClose={() => {
            setAssignTarget(null);
            setSelectedUserId(null);
          }}
          destroyOnClose
          footer={
            <div className="flex justify-end gap-2">
              <Button
                onClick={() => {
                  setAssignTarget(null);
                  setSelectedUserId(null);
                }}
              >
                {t('common.actions.cancel')}
              </Button>

              <Button
                type="primary"
                loading={assignMutation.isPending}
                onClick={() => {
                  if (!assignTarget || !selectedUserId) {
                    messageApi.warning(t('shipments.list.selectUserWarning'));
                    return;
                  }

                  void assignMutation.mutate({
                    simCardId: assignTarget.id,
                    userId: selectedUserId,
                  });
                }}
              >
                {t('shipments.list.assign')}
              </Button>
            </div>
          }
        >
          <Space direction="vertical" className="w-full">
            <div className="text-sm text-fg-primary">
              {t('shipments.list.simColon')}{' '}
              <span className="font-mono">{assignTarget?.iccid}</span>
            </div>

            <Select
              showSearch
              optionFilterProp="label"
              placeholder={t('shipments.list.selectUserPlaceholder')}
              value={selectedUserId ?? undefined}
              onChange={(value) => setSelectedUserId(value)}
              options={userOptions}
            />
          </Space>
        </Drawer>
      </div>
    </PageShell>
  );
}
