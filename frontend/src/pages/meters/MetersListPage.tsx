import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tabs,
  Typography,
  message,
  Tour,
} from 'antd';
import type { TourProps } from 'antd';
import { useState, useEffect } from 'react';
import { PlusOutlined, ThunderboltOutlined, AppstoreOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { metersApi } from '@/api/meters.api';
import { usersApi } from '@/api/users.api';
import { meterTypeDefinitionsApi } from '@/api/meter-type-definitions.api';
import { installationRecordsApi } from '@/api/installation-records.api';
import { demountTasksApi } from '@/api/demount-tasks.api';
import InstallationRecordCreateForm from '@/components/installation-records/InstallationRecordCreateForm';
import type { CreateMeterInput, MeterItem, MeterType, UpdateMeterInput } from '@/types/meter.types';
import type {
  MeterTypeDefinitionItem,
  CreateMeterTypeDefinitionInput,
} from '@/types/meter-type-definition.types';

const meterTypeOptions: { label: string; value: MeterType }[] = [
  { label: 'Jednofazno', value: 'SINGLE_PHASE' },
  { label: 'Trofazno', value: 'THREE_PHASE' },
];

type MeterFormValues = {
  serialNumber: string;
  meterTypeDefinitionId: string;
  year?: number;
  notes?: string;
  installationAddress?: string;
  installationDate?: string;
  city?: string;
  municipality?: string;
  measuringPoint?: string;
  simCardIccid?: string;
  simCardId?: string;
};

type TypeFormValues = {
  name: string;
  manufacturer?: string;
  model?: string;
  type?: MeterType;
  maxCurrent?: string;
  notes?: string;
};

const defaultPagination = { page: 1, limit: 20 };

export default function MetersListPage() {
  const queryClient = useQueryClient();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [activeTab, setActiveTab] = useState<string>('meters');
  const [pagination, setPagination] = useState(defaultPagination);
  const [filterTypeId, setFilterTypeId] = useState<string | undefined>(undefined);
  const [serialSearchInput, setSerialSearchInput] = useState('');
  const [serialNumberFilter, setSerialNumberFilter] = useState<string | undefined>(undefined);
  const [meterModalOpen, setMeterModalOpen] = useState(false);
  const [editingMeter, setEditingMeter] = useState<MeterItem | null>(null);
  const [detailMeter, setDetailMeter] = useState<MeterItem | null>(null);
  const [typeModalOpen, setTypeModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<MeterTypeDefinitionItem | null>(null);
  const [demountModalOpen, setDemountModalOpen] = useState(false);
  const [demountMeter, setDemountMeter] = useState<MeterItem | null>(null);
  const [demountOperatorId, setDemountOperatorId] = useState<string>('');
  const [demountNotes, setDemountNotes] = useState('');

  const [meterForm] = Form.useForm<MeterFormValues>();
  const [typeForm] = Form.useForm<TypeFormValues>();
  const userRole = useAuthStore((s) => s.user?.role);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const seen = window.localStorage.getItem('sim-tracker-page-tour-meters-v1');
    const globalActive = window.localStorage.getItem('sim-tracker-global-tour-active') === '1';
    if (!seen && (userRole === 'SYSTEM_ADMIN' || userRole === 'MODERATOR') && !globalActive) {
      setTourOpen(true);
    }
  }, [userRole]);

  const listQuery = useQuery({
    queryKey: ['meters', 'list', pagination, filterTypeId, serialNumberFilter],
    queryFn: () =>
      metersApi.list({
        ...pagination,
        meterTypeDefinitionId: filterTypeId,
        serialNumber: serialNumberFilter,
      }),
  });

  const meterTypesQuery = useQuery({
    queryKey: ['meter-type-definitions', 'list-all'],
    queryFn: () => meterTypeDefinitionsApi.listAll(),
  });
  const typesListQuery = useQuery({
    queryKey: ['meter-type-definitions', 'list'],
    queryFn: () => meterTypeDefinitionsApi.list({ page: 1, limit: 100 }),
  });
  const meterTypeDefinitionOptions =
    meterTypesQuery.data?.map((t) => ({ label: t.name, value: t.id })) ?? [];

  const operatorsQuery = useQuery({
    queryKey: ['users', 'operators'],
    queryFn: () => usersApi.list({ role: 'USER', limit: 100 }),
    enabled: demountModalOpen,
  });

  const createDemountMutation = useMutation({
    mutationFn: (payload: { meterId: string; assignedToId: string; notes?: string }) =>
      demountTasksApi.create(payload),
    onSuccess: () => {
      messageApi.success('Zadatak demontaže je kreiran.');
      setDemountModalOpen(false);
      setDemountMeter(null);
      setDemountOperatorId('');
      setDemountNotes('');
    },
    onError: (err: unknown) => {
      messageApi.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Kreiranje zadatka nije uspjelo.',
      );
    },
  });

  const recordsByMeterQuery = useQuery({
    queryKey: ['installation-records', 'by-meter', detailMeter?.id],
    queryFn: () =>
      installationRecordsApi.list({
        page: 1,
        limit: 50,
        meterId: detailMeter?.id,
      }),
    enabled: Boolean(detailMeter?.id),
  });

  const createMeterMutation = useMutation({
    mutationFn: (payload: CreateMeterInput) => metersApi.create(payload),
    onSuccess: () => {
      messageApi.success('Brojilo je kreirano.');
      setMeterModalOpen(false);
      setEditingMeter(null);
      meterForm.resetFields();
      void queryClient.invalidateQueries({ queryKey: ['meters', 'list'] });
    },
    onError: (err: unknown) => {
      const msg =
        typeof (err as { response?: { data?: { message?: string } } })?.response?.data?.message ===
        'string'
          ? (err as { response: { data: { message: string } } }).response.data.message
          : 'Kreiranje brojila nije uspjelo.';
      messageApi.error(msg);
    },
  });

  const updateMeterMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateMeterInput }) =>
      metersApi.update(id, payload),
    onSuccess: () => {
      messageApi.success('Brojilo je ažurirano.');
      setMeterModalOpen(false);
      setEditingMeter(null);
      meterForm.resetFields();
      void queryClient.invalidateQueries({ queryKey: ['meters', 'list'] });
      if (detailMeter) void queryClient.invalidateQueries({ queryKey: ['meters', detailMeter.id] });
    },
    onError: (err: unknown) => {
      const msg =
        typeof (err as { response?: { data?: { message?: string } } })?.response?.data?.message ===
        'string'
          ? (err as { response: { data: { message: string } } }).response.data.message
          : 'Ažuriranje brojila nije uspjelo.';
      messageApi.error(msg);
    },
  });

  const deleteMeterMutation = useMutation({
    mutationFn: (id: string) => metersApi.remove(id),
    onSuccess: () => {
      messageApi.success('Brojilo je obrisano.');
      setDetailMeter(null);
      void queryClient.invalidateQueries({ queryKey: ['meters', 'list'] });
    },
    onError: (err: unknown) => {
      const msg =
        typeof (err as { response?: { data?: { message?: string } } })?.response?.data?.message ===
        'string'
          ? (err as { response: { data: { message: string } } }).response.data.message
          : 'Brisanje brojila nije uspjelo.';
      messageApi.error(msg);
    },
  });

  const createTypeMutation = useMutation({
    mutationFn: (payload: CreateMeterTypeDefinitionInput) =>
      meterTypeDefinitionsApi.create(payload),
    onSuccess: () => {
      messageApi.success('Tip brojila je kreiran.');
      setTypeModalOpen(false);
      typeForm.resetFields();
      setEditingType(null);
      void queryClient.invalidateQueries({ queryKey: ['meter-type-definitions'] });
    },
    onError: (err: unknown) => {
      messageApi.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Kreiranje tipa nije uspjelo.',
      );
    },
  });

  const updateTypeMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: { id: string; payload: Partial<CreateMeterTypeDefinitionInput> }) =>
      meterTypeDefinitionsApi.update(id, payload),
    onSuccess: () => {
      messageApi.success('Tip brojila je ažuriran.');
      setTypeModalOpen(false);
      setEditingType(null);
      typeForm.resetFields();
      void queryClient.invalidateQueries({ queryKey: ['meter-type-definitions'] });
    },
    onError: (err: unknown) => {
      messageApi.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Ažuriranje tipa nije uspjelo.',
      );
    },
  });

  const deleteTypeMutation = useMutation({
    mutationFn: (id: string) => meterTypeDefinitionsApi.remove(id),
    onSuccess: () => {
      messageApi.success('Tip brojila je obrisan.');
      void queryClient.invalidateQueries({ queryKey: ['meter-type-definitions'] });
    },
    onError: (err: unknown) => {
      messageApi.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Brisanje tipa nije uspjelo.',
      );
    },
  });

  function openMeterCreate() {
    setEditingMeter(null);
    meterForm.resetFields();
    setMeterModalOpen(true);
  }

  function openMeterEdit(record: MeterItem) {
    setEditingMeter(record);
    meterForm.setFieldsValue({
      serialNumber: record.serialNumber,
      meterTypeDefinitionId: record.meterTypeDefinitionId ?? undefined,
      year: record.year ?? undefined,
      notes: record.notes ?? undefined,
      installationAddress: (record as MeterItem & { installationAddress?: string }).installationAddress ?? undefined,
      installationDate: (record as MeterItem & { installationDate?: string }).installationDate?.slice(0, 10),
      city: (record as MeterItem & { city?: string }).city ?? undefined,
      municipality: (record as MeterItem & { municipality?: string }).municipality ?? undefined,
      measuringPoint: (record as MeterItem & { measuringPoint?: string }).measuringPoint ?? undefined,
    });
    setMeterModalOpen(true);
  }

  function openMeterDetail(record: MeterItem) {
    setDetailMeter(record);
  }

  function openTypeCreate() {
    setEditingType(null);
    typeForm.resetFields();
    setTypeModalOpen(true);
  }

  function openTypeEdit(record: MeterTypeDefinitionItem) {
    setEditingType(record);
    typeForm.setFieldsValue({
      name: record.name,
      manufacturer: record.manufacturer ?? undefined,
      model: record.model ?? undefined,
      type: record.type,
      maxCurrent: record.maxCurrent ?? undefined,
      notes: record.notes ?? undefined,
    });
    setTypeModalOpen(true);
  }

  function handleMeterSubmit(values: MeterFormValues) {
    const payload: Parameters<typeof metersApi.create>[0] = {
      serialNumber: values.serialNumber,
      meterTypeDefinitionId: values.meterTypeDefinitionId,
      year: values.year,
      notes: values.notes,
      installationAddress: values.installationAddress,
      installationDate: values.installationDate,
      city: values.city,
      municipality: values.municipality,
      measuringPoint: values.measuringPoint,
    };
    if (values.simCardId) payload.simCardId = values.simCardId;
    if (editingMeter) {
      updateMeterMutation.mutate({ id: editingMeter.id, payload });
    } else {
      createMeterMutation.mutate(payload);
    }
  }

  function handleTypeSubmit(values: TypeFormValues) {
    if (editingType) {
      updateTypeMutation.mutate({ id: editingType.id, payload: values });
    } else {
      createTypeMutation.mutate(values);
    }
  }

  const meterRows = listQuery.data?.items ?? [];
  const typeRows = typesListQuery.data ?? [];
  const recordsForMeter = recordsByMeterQuery.data?.items ?? [];
  const renderType = (t: MeterType) =>
    t === 'SINGLE_PHASE' ? 'Jednofazno' : t === 'THREE_PHASE' ? 'Trofazno' : t;

  return (
    <div
      className="space-y-4"
      data-tour-id="admin-meters"
      data-tour-role="SYSTEM_ADMIN MODERATOR"
    >
      {messageContextHolder}
      <Typography.Title level={3} className="!mb-0">
        Brojila
      </Typography.Title>
      <Typography.Paragraph type="secondary" className="!mb-4">
        Pregled svih brojila (po serijskim brojevima), upravljanje tipovima brojila te dodavanje i
        izmjena. Jedan tip – više brojila; jedno brojilo – jedna SIM (trenutna), više zapisnika.
      </Typography.Paragraph>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'meters',
            label: (
              <span>
                <ThunderboltOutlined /> Brojila
              </span>
            ),
            children: (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <Space
                    wrap
                    data-tour-id="meters-filters"
                  >
                    <Select
                      allowClear
                      placeholder="Filter po tipu brojila"
                      options={meterTypeDefinitionOptions}
                      value={filterTypeId}
                      onChange={setFilterTypeId}
                      style={{ minWidth: 220 }}
                    />
                    <Input
                      placeholder="Serijski broj"
                      value={serialSearchInput}
                      onChange={(e) => setSerialSearchInput(e.target.value)}
                      onPressEnter={() => {
                        setSerialNumberFilter(serialSearchInput.trim() || undefined);
                        setPagination((p) => ({ ...p, page: 1 }));
                      }}
                      style={{ width: 200 }}
                    />
                    <Button
                      onClick={() => {
                        setSerialNumberFilter(serialSearchInput.trim() || undefined);
                        setPagination((p) => ({ ...p, page: 1 }));
                      }}
                    >
                      Pretraži
                    </Button>
                    {(serialNumberFilter || filterTypeId) && (
                      <Button
                        onClick={() => {
                          setSerialSearchInput('');
                          setSerialNumberFilter(undefined);
                          setFilterTypeId(undefined);
                          setPagination(defaultPagination);
                        }}
                      >
                        Reset
                      </Button>
                    )}
                  </Space>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={openMeterCreate}
                    data-tour-id="meters-new-record"
                  >
                    Novi zapisnik
                  </Button>
                </div>
                {listQuery.isError && (
                  <Typography.Text type="danger">
                    {(listQuery.error as { response?: { data?: { message?: string } } })?.response
                      ?.data?.message ?? 'Učitavanje liste nije uspjelo.'}
                  </Typography.Text>
                )}
                <Table<MeterItem>
                  rowKey="id"
                  loading={listQuery.isLoading}
                  dataSource={meterRows}
                  pagination={{
                    current: listQuery.data?.page,
                    pageSize: listQuery.data?.limit,
                    total: listQuery.data?.total,
                    showSizeChanger: true,
                    showTotal: (total) => `Ukupno: ${total}`,
                    onChange: (page, pageSize) =>
                      setPagination((p) => ({ ...p, page, limit: pageSize ?? 20 })),
                  }}
                  onRow={(record) => ({
                    onClick: () => openMeterDetail(record),
                    style: { cursor: 'pointer' },
                  })}
                  columns={[
                    {
                      title: 'Serijski broj',
                      dataIndex: 'serialNumber',
                      key: 'serialNumber',
                    },
                    {
                      title: 'Tip brojila',
                      key: 'meterTypeDefinition',
                      render: (_: unknown, row: MeterItem) =>
                        row.meterTypeDefinition?.name ?? '–',
                    },
                    {
                      title: 'Proizvođač',
                      key: 'manufacturer',
                      render: (_: unknown, row: MeterItem) =>
                        row.meterTypeDefinition?.manufacturer ?? '–',
                    },
                    {
                      title: 'Model',
                      key: 'model',
                      render: (_: unknown, row: MeterItem) =>
                        row.meterTypeDefinition?.model ?? '–',
                    },
                    {
                      title: 'Godina',
                      dataIndex: 'year',
                      key: 'year',
                      render: (val: number | null) => (val != null ? String(val) : '–'),
                    },
                    {
                      title: 'Akcije',
                      key: 'actions',
                      width: 120,
                      render: (_, record) => (
                        <Space onClick={(e) => e.stopPropagation()}>
                          <Button type="link" size="small" onClick={() => openMeterDetail(record)}>
                            Detalji
                          </Button>
                          <Button type="link" size="small" onClick={() => openMeterEdit(record)}>
                            Uredi
                          </Button>
                          <Popconfirm
                            title="Obrisati brojilo?"
                            description="Ova akcija se ne može poništiti."
                            onConfirm={() => deleteMeterMutation.mutate(record.id)}
                            okText="Da, obriši"
                            cancelText="Odustani"
                            okButtonProps={{ danger: true }}
                          >
                            <Button
                              type="link"
                              size="small"
                              danger
                              disabled={deleteMeterMutation.isPending}
                            >
                              Obriši
                            </Button>
                          </Popconfirm>
                        </Space>
                      ),
                    },
                  ]}
                  data-tour-id="meters-table"
                />
              </div>
            ),
          },
          {
            key: 'types',
            label: (
              <span>
                <AppstoreOutlined /> Tipovi brojila
              </span>
            ),
            children: (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <Typography.Text type="secondary">
                    Katalog tipova brojila (npr. ME84, AMM 3.0). Jedan tip može imati više brojila.
                  </Typography.Text>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={openTypeCreate}
                    data-tour-id="meters-new-type"
                  >
                    Novi tip brojila
                  </Button>
                </div>
                <Table<MeterTypeDefinitionItem>
                  rowKey="id"
                  loading={typesListQuery.isLoading}
                  dataSource={typeRows}
                  pagination={false}
                  columns={[
                    { title: 'Naziv', dataIndex: 'name', key: 'name' },
                    {
                      title: 'Proizvođač',
                      dataIndex: 'manufacturer',
                      key: 'manufacturer',
                      render: (v: string | null) => v ?? '–',
                    },
                    {
                      title: 'Model',
                      dataIndex: 'model',
                      key: 'model',
                      render: (v: string | null) => v ?? '–',
                    },
                    {
                      title: 'Tip',
                      dataIndex: 'type',
                      key: 'type',
                      render: (t: MeterType) => renderType(t),
                    },
                    {
                      title: 'Max struja',
                      dataIndex: 'maxCurrent',
                      key: 'maxCurrent',
                      render: (v: string | null) => v ?? '–',
                    },
                    {
                      title: 'Akcije',
                      key: 'actions',
                      width: 140,
                      render: (_, record) => (
                        <Space>
                          <Button type="link" size="small" onClick={() => openTypeEdit(record)}>
                            Uredi
                          </Button>
                          <Popconfirm
                            title="Obrisati tip brojila?"
                            onConfirm={() => deleteTypeMutation.mutate(record.id)}
                            okText="Da"
                            cancelText="Ne"
                            okButtonProps={{ danger: true }}
                          >
                            <Button type="link" size="small" danger>
                              Obriši
                            </Button>
                          </Popconfirm>
                        </Space>
                      ),
                    },
                  ]}
                  data-tour-id="meters-types-table"
                />
              </div>
            ),
          },
        ]}
      />

      <Drawer
        title={`Brojilo: ${detailMeter?.serialNumber ?? ''}`}
        placement="right"
        width={480}
        open={Boolean(detailMeter)}
        onClose={() => setDetailMeter(null)}
        extra={
          detailMeter ? (
            <Space>
              {(detailMeter as MeterItem & { simCard?: { id: string } }).simCard &&
                (userRole === 'SYSTEM_ADMIN' || userRole === 'MODERATOR') && (
                  <Button
                    size="small"
                    onClick={() => {
                      setDemountMeter(detailMeter);
                      setDemountModalOpen(true);
                    }}
                  >
                    Demontiraj SIM
                  </Button>
                )}
              <Button type="primary" size="small" onClick={() => openMeterEdit(detailMeter)}>
                Uredi
              </Button>
            </Space>
          ) : null
        }
      >
        {detailMeter && (
          <>
            <Descriptions column={1} size="small" bordered className="mb-4">
              <Descriptions.Item label="Serijski broj">{detailMeter.serialNumber}</Descriptions.Item>
              <Descriptions.Item label="Tip brojila">
                {detailMeter.meterTypeDefinition?.name ?? '–'}
              </Descriptions.Item>
              <Descriptions.Item label="Proizvođač">
                {detailMeter.meterTypeDefinition?.manufacturer ?? '–'}
              </Descriptions.Item>
              <Descriptions.Item label="Model">
                {detailMeter.meterTypeDefinition?.model ?? '–'}
              </Descriptions.Item>
              <Descriptions.Item label="Jednofazno / Trofazno">
                {detailMeter.meterTypeDefinition?.type
                  ? renderType(detailMeter.meterTypeDefinition.type)
                  : '–'}
              </Descriptions.Item>
              <Descriptions.Item label="Maks. struja (A)">
                {detailMeter.meterTypeDefinition?.maxCurrent ?? '–'}
              </Descriptions.Item>
              <Descriptions.Item label="Godina">
                {detailMeter.year != null ? String(detailMeter.year) : '–'}
              </Descriptions.Item>
              <Descriptions.Item label="Lokacija instalacije">
                {(detailMeter as MeterItem & { installationAddress?: string }).installationAddress ?? '–'}
              </Descriptions.Item>
              <Descriptions.Item label="Datum instalacije">
                {(detailMeter as MeterItem & { installationDate?: string })?.installationDate?.slice(0, 10) ?? '–'}
              </Descriptions.Item>
              <Descriptions.Item label="Mjerno mjesto">
                {(detailMeter as MeterItem & { measuringPoint?: string }).measuringPoint ?? '–'}
              </Descriptions.Item>
              {((detailMeter as MeterItem).latitude != null || (detailMeter as MeterItem).longitude != null) && (
                <>
                  <Descriptions.Item label="GPS širina">
                    {(detailMeter as MeterItem).latitude != null
                      ? String((detailMeter as MeterItem).latitude)
                      : '–'}
                  </Descriptions.Item>
                  <Descriptions.Item label="GPS dužina">
                    {(detailMeter as MeterItem).longitude != null
                      ? String((detailMeter as MeterItem).longitude)
                      : '–'}
                  </Descriptions.Item>
                </>
              )}
              <Descriptions.Item label="Napomena">
                {detailMeter.notes ?? '–'}
              </Descriptions.Item>
              {(detailMeter as MeterItem & { simCard?: { id: string; iccid: string; ipAddress?: string } }).simCard && (
                <>
                  <Descriptions.Item label="IP adresa">
                    {(detailMeter as MeterItem & { simCard?: { ipAddress?: string } }).simCard?.ipAddress ?? '–'}
                  </Descriptions.Item>
                  <Descriptions.Item label="SIM kartica (ugradjena)">
                    <Link
                      to={`/sim-cards/${(detailMeter as MeterItem & { simCard?: { id: string } }).simCard?.id}`}
                    >
                      {(detailMeter as MeterItem & { simCard?: { iccid: string } }).simCard?.iccid ?? '–'}
                    </Link>
                  </Descriptions.Item>
                </>
              )}
            </Descriptions>
            {(detailMeter as MeterItem).latitude != null &&
              (detailMeter as MeterItem).longitude != null && (
                <div className="mb-4">
                  <Typography.Title level={5}>Lokacija na mapi</Typography.Title>
                  <iframe
                    title="Lokacija brojila"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${
                      Number((detailMeter as MeterItem).longitude) - 0.01
                    },${Number((detailMeter as MeterItem).latitude) - 0.01},${
                      Number((detailMeter as MeterItem).longitude) + 0.01
                    },${Number((detailMeter as MeterItem).latitude) + 0.01}&layer=mapnik&marker=${
                      (detailMeter as MeterItem).latitude
                    },${(detailMeter as MeterItem).longitude}`}
                    width="100%"
                    height="240"
                    style={{ border: 0, borderRadius: 8 }}
                    loading="lazy"
                  />
                </div>
              )}
            <Typography.Title level={5}>Zapisnici za ovo brojilo</Typography.Title>
            {recordsByMeterQuery.isLoading ? (
              <Typography.Text type="secondary">Učitavanje…</Typography.Text>
            ) : recordsForMeter.length === 0 ? (
              <Typography.Text type="secondary">Nema zapisnika.</Typography.Text>
            ) : (
              <ul className="list-disc pl-4 space-y-1">
                {recordsForMeter.map((r) => (
                  <li key={r.id}>
                    <Link to={`/installation-records/${r.id}`}>{r.recordNumber}</Link>
                    {' – '}
                    {r.meter?.simCard?.iccid ?? '–'} ({r.status})
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Drawer>

      <Modal
        title={editingMeter ? 'Uredi brojilo' : 'Novi zapisnik'}
        open={meterModalOpen}
        onCancel={() => {
          setMeterModalOpen(false);
          setEditingMeter(null);
          meterForm.resetFields();
        }}
        destroyOnClose
        width={560}
        footer={
          editingMeter
            ? [
                <Button
                  key="cancel"
                  onClick={() => {
                    setMeterModalOpen(false);
                    setEditingMeter(null);
                    meterForm.resetFields();
                  }}
                >
                  Odustani
                </Button>,
                <Button
                  key="submit"
                  type="primary"
                  loading={updateMeterMutation.isPending}
                  onClick={() => meterForm.submit()}
                >
                  Snimi
                </Button>,
              ]
            : null
        }
      >
        {editingMeter ? (
          <Form
            form={meterForm}
            layout="vertical"
            onFinish={handleMeterSubmit}
            className="mt-4"
          >
            <Form.Item
              name="serialNumber"
              label="Serijski broj"
              rules={[{ required: true, message: 'Unesite serijski broj.' }]}
            >
              <Input placeholder="npr. AMM-12345" />
            </Form.Item>
            <Form.Item
              name="meterTypeDefinitionId"
              label="Tip brojila (katalog) *"
              rules={[{ required: true, message: 'Odaberite tip brojila.' }]}
            >
              <Select
                placeholder="Odaberi tip iz kataloga"
                options={meterTypeDefinitionOptions}
                loading={meterTypesQuery.isLoading}
              />
            </Form.Item>
            <Form.Item name="year" label="Godina proizvodnje">
              <InputNumber
                min={1900}
                max={2100}
                placeholder="Opcionalno"
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Form.Item name="installationAddress" label="Lokacija instalacije">
              <Input.TextArea rows={2} placeholder="Adresa ugradnje" />
            </Form.Item>
            <Form.Item name="installationDate" label="Datum instalacije">
              <Input type="date" placeholder="YYYY-MM-DD" />
            </Form.Item>
            <Form.Item name="city" label="Grad / Mjesto">
              <Input placeholder="Opcionalno" />
            </Form.Item>
            <Form.Item name="municipality" label="Općina">
              <Input placeholder="Opcionalno" />
            </Form.Item>
            <Form.Item name="measuringPoint" label="Mjerno mjesto (MM)">
              <Input placeholder="Opcionalno" />
            </Form.Item>
            <Form.Item name="notes" label="Napomena">
              <Input.TextArea rows={2} placeholder="Opcionalno" />
            </Form.Item>
          </Form>
        ) : (
          <InstallationRecordCreateForm
            embedded
            onSuccess={() => {
              setMeterModalOpen(false);
              setEditingMeter(null);
              void queryClient.invalidateQueries({ queryKey: ['meters'] });
              void queryClient.invalidateQueries({ queryKey: ['installation-records'] });
            }}
            onCancel={() => {
              setMeterModalOpen(false);
              setEditingMeter(null);
            }}
          />
        )}
      </Modal>

      <Modal
        title={editingType ? 'Uredi tip brojila' : 'Novi tip brojila'}
        open={typeModalOpen}
        onCancel={() => {
          setTypeModalOpen(false);
          setEditingType(null);
          typeForm.resetFields();
        }}
        destroyOnClose
        width={520}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setTypeModalOpen(false);
              setEditingType(null);
              typeForm.resetFields();
            }}
          >
            Odustani
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={createTypeMutation.isPending || updateTypeMutation.isPending}
            onClick={() => typeForm.submit()}
          >
            Snimi
          </Button>,
        ]}
      >
        <Form
          form={typeForm}
          layout="vertical"
          onFinish={handleTypeSubmit}
          className="mt-4"
        >
          <Form.Item
            name="name"
            label="Naziv"
            rules={[{ required: true, message: 'Unesite naziv.' }]}
          >
            <Input placeholder="npr. AMM 3.0" />
          </Form.Item>
          <Form.Item name="manufacturer" label="Proizvođač">
            <Input placeholder="Opcionalno" />
          </Form.Item>
          <Form.Item name="model" label="Model">
            <Input placeholder="Opcionalno" />
          </Form.Item>
          <Form.Item name="type" label="Tip">
            <Select allowClear placeholder="Odaberi" options={meterTypeOptions} />
          </Form.Item>
          <Form.Item name="maxCurrent" label="Maks. struja (A)">
            <Input placeholder="Opcionalno" />
          </Form.Item>
          <Form.Item name="notes" label="Napomena">
            <Input.TextArea rows={2} placeholder="Opcionalno" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Zadatak demontaže SIM kartice"
        open={demountModalOpen}
        onCancel={() => {
          setDemountModalOpen(false);
          setDemountMeter(null);
          setDemountOperatorId('');
          setDemountNotes('');
        }}
        onOk={() => {
          if (!demountMeter || !demountOperatorId) return;
          createDemountMutation.mutate({
            meterId: demountMeter.id,
            assignedToId: demountOperatorId,
            notes: demountNotes || undefined,
          });
        }}
        okText="Kreiraj zadatak"
        cancelText="Odustani"
        confirmLoading={createDemountMutation.isPending}
      >
        {demountMeter && (
          <Space direction="vertical" className="w-full" size="middle">
            <Typography.Text>
              Brojilo: {demountMeter.serialNumber}
              {demountMeter.simCard ? ` – SIM: ${demountMeter.simCard.iccid}` : ''}
            </Typography.Text>
            <Form.Item label="Operator (kojem šaljete zadatak)" required>
              <Select
                placeholder="Odaberite operatora"
                value={demountOperatorId || undefined}
                onChange={setDemountOperatorId}
                options={
                  operatorsQuery.data?.items
                    ?.filter((u) => u.role === 'USER')
                    .map((u) => ({
                      label: `${u.firstName} ${u.lastName} (${u.email})`,
                      value: u.id,
                    })) ?? []
                }
                loading={operatorsQuery.isLoading}
                showSearch
                filterOption={(input, opt) =>
                  (opt?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                }
              />
            </Form.Item>
            <Form.Item label="Napomena">
              <Input.TextArea
                rows={2}
                value={demountNotes}
                onChange={(e) => setDemountNotes(e.target.value)}
                placeholder="Opcionalno"
              />
            </Form.Item>
          </Space>
        )}
      </Modal>
      <Tour
        open={tourOpen}
        current={tourStep}
        onClose={() => {
          setTourOpen(false);
          if (typeof window !== 'undefined') {
            window.localStorage.setItem('sim-tracker-page-tour-meters-v1', '1');
          }
        }}
        onChange={(next) => setTourStep(next)}
        steps={
          [
            {
              title: 'Pregled brojila',
              description:
                'Ovdje vidiš sva brojila po serijskom broju i osnovnim karakteristikama.',
              target: () =>
                document.querySelector('[data-tour-id="admin-meters"]') as HTMLElement,
            },
            {
              title: 'Filteri brojila',
              description:
                'Filtriraj brojila po tipu i pretražuj po serijskom broju da brzo pronađeš uređaj.',
              target: () =>
                document.querySelector('[data-tour-id="meters-filters"]') as HTMLElement,
            },
            {
              title: 'Kreiranje zapisnika sa brojila',
              description:
                'Dugme „Novi zapisnik“ otvara wizard za novu ugradnju SIM kartice na brojilo.',
              target: () =>
                document.querySelector('[data-tour-id="meters-new-record"]') as HTMLElement,
            },
            {
              title: 'Tabela brojila',
              description:
                'Klikom na red otvaraš detalje brojila, SIM karticu, lokaciju i povezane zapisnike.',
              target: () =>
                document.querySelector('[data-tour-id="meters-table"]') as HTMLElement,
            },
            {
              title: 'Katalog tipova brojila',
              description:
                'Drugi tab sadrži katalog tipova brojila (proizvođač, model, faznost, maksimalna struja).',
              target: () =>
                document.querySelector('[data-tour-id="meters-types-table"]') as HTMLElement,
            },
            {
              title: 'Dodavanje novog tipa brojila',
              description:
                'Koristi „Novi tip brojila“ da proširiš katalog; tip se kasnije bira pri definisanju brojila.',
              target: () =>
                document.querySelector('[data-tour-id="meters-new-type"]') as HTMLElement,
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
