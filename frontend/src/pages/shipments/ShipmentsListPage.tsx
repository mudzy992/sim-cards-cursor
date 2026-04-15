import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Drawer,
  Input,
  Popconfirm,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import { useMemo, useState } from 'react';
import { InboxOutlined, CreditCardOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { shipmentsApi } from '@/api/shipments.api';
import { simCardsApi } from '@/api/sim-cards.api';
import { usersApi } from '@/api/users.api';
import { useAuthStore } from '@/store/auth.store';
import { getSimCardStatusLabel } from '@/utils/labels.utils'
import type {
  ShipmentItem,
  ShipmentListParams,
  ShipmentStatus,
} from '@/types/shipment.types';
import type { SimCardItem, SimCardListParams, SimCardStatus } from '@/types/sim-card.types';

const shipmentStatusColor: Record<string, string> = {
  RECEIVED: 'blue',
  PROCESSING: 'orange',
  COMPLETED: 'green',
};

const simStatusColor: Record<string, string> = {
  AVAILABLE: 'green',
  ASSIGNED: 'orange',
  INSTALLED: 'blue',
  DEFECTIVE: 'red',
  RETURNED: 'gold',
  DEACTIVATED: 'default',
};

const shipmentStatusOptions: ShipmentStatus[] = ['RECEIVED', 'PROCESSING', 'COMPLETED'];

const simStatusOptions: SimCardStatus[] = [
  'AVAILABLE',
  'ASSIGNED',
  'INSTALLED',
  'DEFECTIVE',
  'RETURNED',
  'DEACTIVATED',
];

const defaultShipmentFilters: ShipmentListParams = {
  page: 1,
  limit: 20,
};

export default function ShipmentsListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [activeTab, setActiveTab] = useState<string>('shipments');
  const currentUserRole = useAuthStore((s) => s.user?.role);
  const canManageShipments = currentUserRole === 'SYSTEM_ADMIN' || currentUserRole === 'DIST_ADMIN';

  const [shipmentFilters, setShipmentFilters] = useState<ShipmentListParams>(defaultShipmentFilters);
  const [searchInput, setSearchInput] = useState('');
  const [providerInput, setProviderInput] = useState('');

  const [simFilters, setSimFilters] = useState<SimCardListParams>({ page: 1, limit: 20 });
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
      messageApi.success('SIM kartica je dodijeljena korisniku.');
      setAssignTarget(null);
      setSelectedUserId(null);
      await queryClient.invalidateQueries({ queryKey: ['sim-cards', 'list'] });
    },
    onError: () => {
      messageApi.error('Dodjela nije uspjela.');
    },
  });

  const unassignMutation = useMutation({
    mutationFn: (simCardId: string) => simCardsApi.unassign(simCardId),
    onSuccess: async () => {
      messageApi.success('SIM kartica je vraćena na AVAILABLE.');
      await queryClient.invalidateQueries({ queryKey: ['sim-cards', 'list'] });
    },
    onError: () => {
      messageApi.error('Oduzimanje nije uspjelo.');
    },
  });

  const removeShipmentMutation = useMutation({
    mutationFn: (id: string) => shipmentsApi.remove(id),
    onSuccess: async () => {
      messageApi.success('Isporuka je obrisana.')
      await queryClient.invalidateQueries({ queryKey: ['shipments', 'list'] })
      await queryClient.invalidateQueries({ queryKey: ['shipments', 'list', 'for-filter'] })
    },
    onError: (e: unknown) => {
      const maybeMessage = (e as { response?: { data?: { message?: string } } })?.response?.data
        ?.message
      messageApi.error(typeof maybeMessage === 'string' ? maybeMessage : 'Brisanje nije uspjelo.')
    },
  })

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

  const handleShipmentSearch = () => {
    setShipmentFilters((prev) => ({
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

  const tabItems = [
    {
      key: 'shipments',
      label: (
        <span>
          <InboxOutlined /> Isporuke
        </span>
      ),
      children: (
        <div className="space-y-4">
          <div
            className="flex flex-wrap items-center justify-between gap-4"
            data-tour-id="shipments-header"
          >
            <Typography.Text type="secondary">
              Pregled isporuka SIM kartica. Pretraga i filteri.
            </Typography.Text>
            {canManageShipments && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => navigate('/shipments/new')}
                data-tour-id="shipments-new-button"
              >
                Nova isporuka
              </Button>
            )}
          </div>
          <Space
            wrap
            className="w-full"
            data-tour-id="shipments-filters"
          >
            <Input
              placeholder="Pretraga naziva"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onPressEnter={handleShipmentSearch}
              style={{ width: 220 }}
            />
            <Input
              placeholder="Filter po provajderu"
              value={providerInput}
              onChange={(e) => setProviderInput(e.target.value)}
              onPressEnter={handleShipmentSearch}
              style={{ width: 220 }}
            />
            <Select
              allowClear
              placeholder="Status"
              style={{ width: 160 }}
              value={shipmentFilters.status}
              onChange={(value) =>
                setShipmentFilters((prev) => ({ ...prev, page: 1, status: value }))
              }
              options={shipmentStatusOptions.map((s) => ({ label: s, value: s }))}
            />
            <Button onClick={handleShipmentSearch}>Pretraži</Button>
            <Button onClick={handleShipmentReset}>Reset</Button>
          </Space>

          <Table<ShipmentItem>
            rowKey="id"
            loading={shipmentsQuery.isLoading}
            dataSource={shipmentRows}
            pagination={{
              current: shipmentsQuery.data?.page,
              pageSize: shipmentsQuery.data?.limit,
              total: shipmentsQuery.data?.total,
              showSizeChanger: true,
              showTotal: (total) => `Ukupno: ${total}`,
              onChange: (page, pageSize) =>
                setShipmentFilters((prev) => ({
                  ...prev,
                  page,
                  limit: pageSize ?? 20,
                })),
            }}
            columns={[
              {
                title: 'Naziv',
                render: (_, row) => (
                  <Button
                    type="link"
                    onClick={() => navigate(`/shipments/${row.id}`)}
                    className="p-0"
                  >
                    {row.name}
                  </Button>
                ),
              },
              { title: 'Provajder', dataIndex: 'provider' },
              {
                title: 'Datum prijema',
                dataIndex: 'receivedDate',
                render: (val: string) => (val ? new Date(val).toLocaleDateString() : '–'),
              },
              {
                title: 'SIM kartica',
                render: (_, row) => row._count?.simCards ?? 0,
              },
              {
                title: 'Status',
                dataIndex: 'status',
                render: (status: string) => (
                  <Tag color={shipmentStatusColor[status] ?? 'default'}>{status}</Tag>
                ),
              },
              {
                title: 'Akcije',
                width: 140,
                render: (_: unknown, row) => {
                  const simCount = row._count?.simCards ?? 0
                  const canDelete = canManageShipments && simCount === 0
                  if (!canDelete) return null
                  return (
                    <Popconfirm
                      title="Obrisati isporuku?"
                      description="Isporuka nema SIM kartica i može se obrisati."
                      okText="Obriši"
                      cancelText="Odustani"
                      okButtonProps={{ danger: true, loading: removeShipmentMutation.isPending }}
                      onConfirm={() => removeShipmentMutation.mutate(row.id)}
                    >
                      <Button danger size="small">
                        Obriši
                      </Button>
                    </Popconfirm>
                  )
                },
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
          <CreditCardOutlined /> SIM kartice
        </span>
      ),
      children: (
        <div className="space-y-4">
          <Typography.Text type="secondary">
            Distribucijski admin vidi samo SIM kartice iz isporuka dodijeljenih njegovoj distribuciji.
          </Typography.Text>

          <Space
            wrap
            data-tour-id="shipments-sim-filters"
          >
            <Input.Search
              allowClear
              placeholder="Pretraga ICCID/IP"
              value={simSearchInput}
              onChange={(e) => setSimSearchInput(e.target.value)}
              onSearch={(value) =>
                setSimFilters((prev) => ({
                  ...prev,
                  page: 1,
                  search: value.trim() || undefined,
                }))
              }
              style={{ width: 280 }}
            />
            <Select
              allowClear
              placeholder="Status"
              style={{ width: 180 }}
              value={simFilters.status}
              onChange={(value) =>
                setSimFilters((prev) => ({ ...prev, page: 1, status: value }))
              }
              options={simStatusOptions.map((s) => ({ label: s, value: s }))}
            />
            <Select
              allowClear
              placeholder="Isporuka"
              style={{ width: 220 }}
              value={simFilters.shipmentId}
              onChange={(value) =>
                setSimFilters((prev) => ({ ...prev, page: 1, shipmentId: value }))
              }
              options={shipmentOptions}
            />
            <Button
              onClick={() => {
                setSimSearchInput('');
                setSimFilters({ page: 1, limit: 20 });
              }}
            >
              Reset
            </Button>
          </Space>

          <Table<SimCardItem>
            rowKey="id"
            loading={simCardsQuery.isLoading}
            dataSource={simRows}
            pagination={{
              current: simCardsQuery.data?.page,
              pageSize: simCardsQuery.data?.limit,
              total: simCardsQuery.data?.total,
              showSizeChanger: true,
              onChange: (page, pageSize) =>
                setSimFilters((prev) => ({ ...prev, page, limit: pageSize ?? 20 })),
            }}
            columns={[
              {
                title: 'ICCID',
                render: (_, row) => (
                  <Button type="link" onClick={() => navigate(`/sim-cards/${row.id}`)}>
                    {row.iccid}
                  </Button>
                ),
              },
              { title: 'IP', dataIndex: 'ipAddress' },
              {
                title: 'Javna IP',
                render: (_, row) => row.publicIpAddress ?? '-',
              },
              {
                title: 'Status',
                dataIndex: 'status',
                render: (status: string) => (
                  <Tag color={simStatusColor[status] ?? 'default'}>
                    {getSimCardStatusLabel(status as SimCardStatus)}
                  </Tag>
                ),
              },
              {
                title: 'Isporuka',
                render: (_, row) => row.shipment.name,
              },
              {
                title: 'Dodijeljena',
                render: (_, row) =>
                  row.assignedTo
                    ? `${row.assignedTo.firstName} ${row.assignedTo.lastName}`
                    : '-',
              },
              {
                title: 'Akcije',
                render: (_, row) => (
                  <Space>
                    <Button
                      size="small"
                      onClick={() => {
                        setAssignTarget(row);
                        setSelectedUserId(row.assignedTo?.id ?? null);
                      }}
                      disabled={!(row.status === 'AVAILABLE' || row.status === 'ASSIGNED')}
                    >
                      Dodijeli
                    </Button>
                    <Button
                      size="small"
                      danger
                      onClick={() => void unassignMutation.mutate(row.id)}
                      disabled={row.status !== 'ASSIGNED'}
                      loading={unassignMutation.isPending}
                    >
                      Oduzmi
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
    <div
      className="space-y-4"
      data-tour-id="admin-shipments-sim"
      data-tour-role="SYSTEM_ADMIN DIST_ADMIN"
    >
      {messageContextHolder}
      <Typography.Title level={3} className="!mb-0">
        Isporuke
      </Typography.Title>

      <Typography.Paragraph type="secondary" className="!mb-4">
        Isporuke SIM kartica i pregled kartica. Sistemski administrator može dodavati isporuke i birati
        distribuciju. Distribucijski admin može dodavati isporuke i importovati liste samo za svoju
        distribuciju.
      </Typography.Paragraph>

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />

      <Drawer
        title="Dodjela SIM kartice"
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
                setAssignTarget(null)
                setSelectedUserId(null)
              }}
            >
              Odustani
            </Button>
            <Button
              type="primary"
              loading={assignMutation.isPending}
              onClick={() => {
                if (!assignTarget || !selectedUserId) {
                  messageApi.warning('Odaberi korisnika za dodjelu.')
                  return
                }
                void assignMutation.mutate({
                  simCardId: assignTarget.id,
                  userId: selectedUserId,
                })
              }}
            >
              Dodijeli
            </Button>
          </div>
        }
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Text>SIM: {assignTarget?.iccid}</Typography.Text>
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Odaberi korisnika"
            value={selectedUserId ?? undefined}
            onChange={(value) => setSelectedUserId(value)}
            options={userOptions}
          />
        </Space>
      </Drawer>
    </div>
  );
}
