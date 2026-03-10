import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
  Tour,
} from 'antd';
import type { TourProps } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { InboxOutlined, CreditCardOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { shipmentsApi } from '@/api/shipments.api';
import { simCardsApi } from '@/api/sim-cards.api';
import { usersApi } from '@/api/users.api';
import { useAuthStore } from '@/store/auth.store';
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
  const isSystemAdmin = currentUserRole === 'SYSTEM_ADMIN';

  const [shipmentFilters, setShipmentFilters] = useState<ShipmentListParams>(defaultShipmentFilters);
  const [searchInput, setSearchInput] = useState('');
  const [providerInput, setProviderInput] = useState('');

  const [simFilters, setSimFilters] = useState<SimCardListParams>({ page: 1, limit: 20 });
  const [simSearchInput, setSimSearchInput] = useState('');
  const [assignTarget, setAssignTarget] = useState<SimCardItem | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const seen = window.localStorage.getItem('sim-tracker-page-tour-shipments-v1');
    const globalActive = window.localStorage.getItem('sim-tracker-global-tour-active') === '1';
    if (!seen && isSystemAdmin && !globalActive) {
      setTourOpen(true);
    }
  }, [isSystemAdmin]);

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
            {isSystemAdmin && (
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
            Moderator vidi samo SIM kartice iz isporuka dodijeljenih njegovoj distribuciji.
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
                  <Tag color={simStatusColor[status] ?? 'default'}>{status}</Tag>
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
      data-tour-role="SYSTEM_ADMIN MODERATOR"
    >
      {messageContextHolder}
      <Typography.Title level={3} className="!mb-0">
        Isporuke
      </Typography.Title>

      <Typography.Paragraph type="secondary" className="!mb-4">
        Isporuke SIM kartica i pregled kartica. Samo sistemski administrator može dodavati isporuke
        i importovati liste – pri tome dodjeljuje distribuciji. Moderator vidi SIM kartice svojih
        isporuka.
      </Typography.Paragraph>

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />

      <Modal
        title="Dodjela SIM kartice"
        open={Boolean(assignTarget)}
        onCancel={() => {
          setAssignTarget(null);
          setSelectedUserId(null);
        }}
        onOk={() => {
          if (!assignTarget || !selectedUserId) {
            messageApi.warning('Odaberi korisnika za dodjelu.');
            return;
          }
          void assignMutation.mutate({
            simCardId: assignTarget.id,
            userId: selectedUserId,
          });
        }}
        okButtonProps={{ loading: assignMutation.isPending }}
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
      </Modal>
      <Tour
        open={tourOpen}
        current={tourStep}
        onClose={() => {
          setTourOpen(false);
          if (typeof window !== 'undefined') {
            window.localStorage.setItem('sim-tracker-page-tour-shipments-v1', '1');
          }
        }}
        onChange={(next) => setTourStep(next)}
        steps={
          [
            {
              title: 'Pregled isporuka',
              description:
                'Ovdje vidiš sve isporuke SIM kartica, broj kartica u svakoj i njihov status.',
              target: () =>
                document.querySelector('[data-tour-id="shipments-header"]') as HTMLElement,
            },
            {
              title: 'Filteri i pretraga isporuka',
              description:
                'Pretraga po nazivu, provajderu i statusu ti omogućava brzo sužavanje liste isporuka.',
              target: () =>
                document.querySelector('[data-tour-id="shipments-filters"]') as HTMLElement,
            },
            {
              title: 'Tabela isporuka',
              description:
                'Klikom na naziv isporuke otvaraš detalje i Excel import; kolone prikazuju osnovne podatke.',
              target: () =>
                document.querySelector('[data-tour-id="shipments-table"]') as HTMLElement,
            },
            {
              title: 'Kreiranje nove isporuke',
              description:
                'Samo sistemski administrator može otvoriti novu isporuku i importovati listu SIM kartica.',
              target: () =>
                document.querySelector('[data-tour-id="shipments-new-button"]') as HTMLElement,
            },
            {
              title: 'SIM kartice po isporukama',
              description:
                'Drugi tab prikazuje pojedinačne SIM kartice sa filtrima po ICCID/IP, statusu i isporuci.',
              target: () =>
                document.querySelector('[data-tour-id="shipments-sim-filters"]') as HTMLElement,
            },
            {
              title: 'Tabela SIM kartica i dodjela',
              description:
                'U tabeli vidiš sve SIM kartice; preko akcija možeš dodijeliti ili oduzeti karticu korisniku.',
              target: () =>
                document.querySelector('[data-tour-id="shipments-sim-table"]') as HTMLElement,
            },
          ].filter((step) => {
            try {
              return Boolean(step.target && step.target());
            } catch {
              return false;
            }
          }) as TourProps['steps']
        }
      />
    </div>
  );
}
