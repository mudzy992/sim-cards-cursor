import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Typography,
  message,
} from 'antd';
import { useState, useEffect } from 'react';
import { PlusOutlined, ThunderboltOutlined, AppstoreOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { metersApi } from '@/api/meters.api';
import { usersApi } from '@/api/users.api';
import { meterTypeDefinitionsApi } from '@/api/meter-type-definitions.api';
import { installationRecordsApi } from '@/api/installation-records.api';
import { demountTasksApi } from '@/api/demount-tasks.api';
import { installTasksApi } from '@/api/install-tasks.api';
import InstallationRecordCreateForm from '@/components/installation-records/InstallationRecordCreateForm';
import type { CreateMeterInput, MeterItem, MeterType, UpdateMeterInput } from '@/types/meter.types';
import type { MeterTypeFieldItem } from '@/types/meter-type-field.types'
import type {
  MeterTypeDefinitionItem,
} from '@/types/meter-type-definition.types';
import { buildOsmEmbedUrl } from '@/utils/osm.utils'

const meterTypeOptions: { label: string; value: MeterType }[] = [
  { label: 'Jednofazno', value: 'SINGLE_PHASE' },
  { label: 'Trofazno', value: 'THREE_PHASE' },
];

type MeterFormValues = {
  serialNumber: string;
  meterTypeDefinitionId: string;
  year?: number;
  calibrationYear?: number;
  notes?: string;
  installationAddress?: string;
  installationDate?: string;
  city?: string;
  municipality?: string;
  measuringPoint?: string;
  simCardIccid?: string;
  simCardId?: string;
  dynamicFieldValues?: Record<string, {}>;
};

const defaultPagination = { page: 1, limit: 20 };

export default function MetersListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [activeTab, setActiveTab] = useState<string>('meters');
  const [pagination, setPagination] = useState(defaultPagination);
  const [filterTypeId, setFilterTypeId] = useState<string | undefined>(undefined);
  const [serialSearchInput, setSerialSearchInput] = useState('');
  const [serialNumberFilter, setSerialNumberFilter] = useState<string | undefined>(undefined);
  const [meterDrawerOpen, setMeterDrawerOpen] = useState(false);
  const [editingMeter, setEditingMeter] = useState<MeterItem | null>(null);
  const [detailMeter, setDetailMeter] = useState<MeterItem | null>(null);
  const [demountDrawerOpen, setDemountDrawerOpen] = useState(false);
  const [demountMeter, setDemountMeter] = useState<MeterItem | null>(null);
  const [demountOperatorId, setDemountOperatorId] = useState<string>('');
  const [demountNotes, setDemountNotes] = useState('');
  const [installDrawerOpen, setInstallDrawerOpen] = useState(false);
  const [installMeter, setInstallMeter] = useState<MeterItem | null>(null);
  const [installOperatorId, setInstallOperatorId] = useState<string>('');
  const [installNotes, setInstallNotes] = useState('');

  const [meterForm] = Form.useForm<MeterFormValues>();
  const userRole = useAuthStore((s) => s.user?.role);
  const user = useAuthStore((s) => s.user);

  const selectedEditMeterTypeDefinitionId = Form.useWatch('meterTypeDefinitionId', meterForm) as
    | string
    | undefined

  const meterTypeFieldsQuery = useQuery({
    queryKey: ['meter-type-definitions', 'fields', selectedEditMeterTypeDefinitionId],
    queryFn: () => meterTypeDefinitionsApi.listFields(selectedEditMeterTypeDefinitionId!),
    enabled: Boolean(selectedEditMeterTypeDefinitionId) && Boolean(editingMeter),
  })

  const detailMeterTypeFieldsQuery = useQuery({
    queryKey: ['meter-type-definitions', 'fields', detailMeter?.meterTypeDefinitionId],
    queryFn: () => meterTypeDefinitionsApi.listFields(detailMeter!.meterTypeDefinitionId),
    enabled: Boolean(detailMeter?.meterTypeDefinitionId),
  })

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
    enabled: demountDrawerOpen || installDrawerOpen,
  });

  const createDemountMutation = useMutation({
    mutationFn: (payload: { meterId: string; assignedToId: string; notes?: string }) =>
      demountTasksApi.create(payload),
    onSuccess: () => {
      messageApi.success('Zadatak demontaže je kreiran.');
      setDemountDrawerOpen(false);
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

  const createInstallMutation = useMutation({
    mutationFn: (payload: { meterId: string; assignedToId: string; notes?: string }) =>
      installTasksApi.create(payload),
    onSuccess: () => {
      messageApi.success('Zadatak ugradnje SIM-a je kreiran.');
      setInstallDrawerOpen(false);
      setInstallMeter(null);
      setInstallOperatorId('');
      setInstallNotes('');
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
      setMeterDrawerOpen(false);
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
      setMeterDrawerOpen(false);
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
    setMeterDrawerOpen(true);
  }

  function openMeterEdit(record: MeterItem) {
    setEditingMeter(record);
    meterForm.setFieldsValue({
      serialNumber: record.serialNumber,
      meterTypeDefinitionId: record.meterTypeDefinitionId ?? undefined,
      year: record.year ?? undefined,
      calibrationYear: record.calibrationYear ?? undefined,
      notes: record.notes ?? undefined,
      installationAddress: (record as MeterItem & { installationAddress?: string }).installationAddress ?? undefined,
      installationDate: (record as MeterItem & { installationDate?: string }).installationDate?.slice(0, 10),
      city: (record as MeterItem & { city?: string }).city ?? undefined,
      municipality: (record as MeterItem & { municipality?: string }).municipality ?? undefined,
      measuringPoint: (record as MeterItem & { measuringPoint?: string }).measuringPoint ?? undefined,
      dynamicFieldValues: (record.dynamicFieldValues as Record<string, {}> | null) ?? undefined,
    });
    setMeterDrawerOpen(true);
  }

  function openMeterDetail(record: MeterItem) {
    setDetailMeter(record);
  }

  function openTypeCreate() {
    navigate('/meter-types/new')
  }

  function openTypeEdit(record: MeterTypeDefinitionItem) {
    navigate(`/meter-types/${record.id}`)
  }


  function handleMeterSubmit(values: MeterFormValues) {
    const payload: Parameters<typeof metersApi.create>[0] = {
      serialNumber: values.serialNumber,
      meterTypeDefinitionId: values.meterTypeDefinitionId,
      year: values.year,
      calibrationYear: values.calibrationYear,
      notes: values.notes,
      installationAddress: values.installationAddress,
      installationDate: values.installationDate,
      city: values.city,
      municipality: values.municipality,
      measuringPoint: values.measuringPoint,
      dynamicFieldValues: values.dynamicFieldValues as Record<string, unknown> | undefined,
    };
    if (values.simCardId) payload.simCardId = values.simCardId;
    if (editingMeter) {
      updateMeterMutation.mutate({ id: editingMeter.id, payload });
    } else {
      createMeterMutation.mutate(payload);
    }
  }

  const isDynamicFieldEditable = (field: MeterTypeFieldItem) => field.isOperatorFillable

  const renderDynamicFieldInput = (field: MeterTypeFieldItem) => {
    if (field.fieldType === 'NUMBER') {
      return <InputNumber disabled={!isDynamicFieldEditable(field)} style={{ width: '100%' }} />
    }
    if (field.fieldType === 'BOOLEAN') {
      return <Switch disabled={!isDynamicFieldEditable(field)} />
    }
    if (field.fieldType === 'DATE') {
      return <Input type="date" disabled={!isDynamicFieldEditable(field)} />
    }
    return <Input disabled={!isDynamicFieldEditable(field)} />
  }

  const formatDynamicFieldValue = (field: MeterTypeFieldItem, raw: unknown) => {
    if (raw === undefined || raw === null || raw === '') return null
    if (field.fieldType === 'BOOLEAN') {
      return raw === true || raw === 'true' ? 'Da' : 'Ne'
    }
    if (field.fieldType === 'DATE') {
      const d = new Date(String(raw))
      return Number.isNaN(d.getTime()) ? String(raw) : d.toLocaleDateString('bs-BA')
    }
    return String(raw)
  }

  const meterRows = listQuery.data?.items ?? [];
  const typeRows = typesListQuery.data ?? [];
  const recordsForMeter = recordsByMeterQuery.data?.items ?? [];
  const renderType = (t: MeterType) =>
    t === 'SINGLE_PHASE' ? 'Jednofazno' : t === 'THREE_PHASE' ? 'Trofazno' : t;

  const canCreateInstallTaskForMeter = (m: MeterItem | null) => {
    if (!m) return false
    const isNoSim = m.simCardState === 'NO_SIM' || !m.simCard
    if (!isNoSim) return false
    if (userRole === 'SYSTEM_ADMIN' || userRole === 'DIST_ADMIN') return true
    const moderated = user?.branchModeratorBranchIds ?? []
    const branchId = m.branchId ?? ''
    return Boolean(branchId) && moderated.includes(branchId)
  }

  return (
    <div
      className="space-y-4"
      data-tour-id="admin-meters"
      data-tour-role="SYSTEM_ADMIN DIST_ADMIN"
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
                      title: 'God. proizv.',
                      dataIndex: 'year',
                      key: 'year',
                      render: (val: number | null) => (val != null ? String(val) : '–'),
                    },
                    {
                      title: 'God. baždarenja',
                      dataIndex: 'calibrationYear',
                      key: 'calibrationYear',
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
                  {userRole === 'SYSTEM_ADMIN' && (
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={openTypeCreate}
                      data-tour-id="meters-new-type"
                    >
                      Novi tip brojila
                    </Button>
                  )}
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
                      width: 160,
                      render: (_, record) => (
                        <Space>
                          {userRole === 'SYSTEM_ADMIN' ? (
                            <>
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
                                <Button
                                  type="link"
                                  size="small"
                                  danger
                                  disabled={deleteTypeMutation.isPending}
                                >
                                  Obriši
                                </Button>
                              </Popconfirm>
                            </>
                          ) : (
                            <Button type="link" size="small" onClick={() => openTypeEdit(record)}>
                              Detalji
                            </Button>
                          )}
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
                (userRole === 'SYSTEM_ADMIN' || userRole === 'DIST_ADMIN') && (
                  <Button
                    size="small"
                    onClick={() => {
                      setDemountMeter(detailMeter);
                      setDemountDrawerOpen(true);
                    }}
                  >
                    Demontiraj SIM
                  </Button>
                )}
              {canCreateInstallTaskForMeter(detailMeter) && (
                <Button
                  size="small"
                  onClick={() => {
                    setInstallMeter(detailMeter)
                    setInstallDrawerOpen(true)
                  }}
                >
                  Pošalji ugradnju SIM
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
              <Descriptions.Item label="Godina proizvodnje">
                {detailMeter.year != null ? String(detailMeter.year) : '–'}
              </Descriptions.Item>
              <Descriptions.Item label="Godina baždarenja">
                {detailMeter.calibrationYear != null ? String(detailMeter.calibrationYear) : '–'}
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
              <Descriptions.Item label="Status SIM-a">
                {detailMeter.simCardState === 'NO_SIM' || !detailMeter.simCard
                  ? `Bez kartice${detailMeter.noSimReason ? ` (${detailMeter.noSimReason})` : ''}`
                  : 'Ugrađena'}
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
              {(detailMeter.dynamicFieldValues &&
                Object.keys(detailMeter.dynamicFieldValues).length > 0 &&
                (detailMeterTypeFieldsQuery.data ?? []).some((f) => {
                  const vals = detailMeter.dynamicFieldValues as Record<string, unknown>
                  const v = vals[f.name]
                  return v !== undefined && v !== null && v !== ''
                })) && (
                <>
                  {(detailMeterTypeFieldsQuery.data ?? [])
                    .slice()
                    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                    .map((field) => {
                      const vals = (detailMeter.dynamicFieldValues ?? {}) as Record<string, unknown>
                      const display = formatDynamicFieldValue(field, vals[field.name])
                      if (!display) return null
                      return (
                        <Descriptions.Item key={field.id} label={field.label}>
                          {display}
                        </Descriptions.Item>
                      )
                    })}
                </>
              )}
            </Descriptions>
            {(detailMeter as MeterItem).latitude != null &&
              (detailMeter as MeterItem).longitude != null && (
                <div className="mb-4">
                  <Typography.Title level={5}>Lokacija na mapi</Typography.Title>
                  <iframe
                    title="Lokacija brojila"
                    src={buildOsmEmbedUrl({
                      latitude: Number((detailMeter as MeterItem).latitude),
                      longitude: Number((detailMeter as MeterItem).longitude),
                      radiusMeters: 50,
                    })}
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

      <Drawer
        title={editingMeter ? 'Uredi brojilo' : 'Novi zapisnik'}
        open={meterDrawerOpen}
        width={560}
        onClose={() => {
          setMeterDrawerOpen(false)
          setEditingMeter(null)
          meterForm.resetFields()
        }}
        destroyOnClose
        footer={
          editingMeter ? (
            <div className="flex justify-end gap-2">
              <Button
                onClick={() => {
                  setMeterDrawerOpen(false)
                  setEditingMeter(null)
                  meterForm.resetFields()
                }}
              >
                Odustani
              </Button>
              <Button
                type="primary"
                loading={updateMeterMutation.isPending}
                onClick={() => meterForm.submit()}
              >
                Snimi
              </Button>
            </div>
          ) : null
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
            <Form.Item
              name="year"
              label="Godina proizvodnje"
              rules={[{ required: true, message: 'Obavezno.' }]}
            >
              <InputNumber min={1970} max={2100} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              name="calibrationYear"
              label="Godina baždarenja"
              rules={[{ required: true, message: 'Obavezno.' }]}
            >
              <InputNumber min={1970} max={2100} style={{ width: '100%' }} />
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

            {selectedEditMeterTypeDefinitionId && (
              <div className="rounded-md border border-slate-200 p-3">
                <div className="font-medium mb-2">Dodatna polja</div>
                {(meterTypeFieldsQuery.data ?? [])
                  .slice()
                  .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                  .map((field) => (
                    <Form.Item
                      key={field.id}
                      name={['dynamicFieldValues', field.name]}
                      label={field.label}
                      initialValue={field.defaultValue ?? undefined}
                      valuePropName={field.fieldType === 'BOOLEAN' ? 'checked' : 'value'}
                      rules={
                        field.isRequired && isDynamicFieldEditable(field)
                          ? [{ required: true, message: `Unesite: ${field.label}` }]
                          : []
                      }
                    >
                      {renderDynamicFieldInput(field)}
                    </Form.Item>
                  ))}
                {meterTypeFieldsQuery.isLoading && (
                  <div className="text-sm text-slate-500">Učitavanje polja…</div>
                )}
              </div>
            )}
          </Form>
        ) : (
          <InstallationRecordCreateForm
            embedded
            onSuccess={() => {
              setMeterDrawerOpen(false);
              setEditingMeter(null);
              void queryClient.invalidateQueries({ queryKey: ['meters'] });
              void queryClient.invalidateQueries({ queryKey: ['installation-records'] });
            }}
            onCancel={() => {
              setMeterDrawerOpen(false);
              setEditingMeter(null);
            }}
          />
        )}
      </Drawer>

      <Drawer
        title="Zadatak ugradnje SIM kartice"
        open={installDrawerOpen}
        width={520}
        onClose={() => {
          setInstallDrawerOpen(false)
          setInstallMeter(null)
          setInstallOperatorId('')
          setInstallNotes('')
        }}
        destroyOnClose
        footer={
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                setInstallDrawerOpen(false)
                setInstallMeter(null)
                setInstallOperatorId('')
                setInstallNotes('')
              }}
            >
              Odustani
            </Button>
            <Button
              type="primary"
              loading={createInstallMutation.isPending}
              onClick={() => {
                if (!installMeter || !installOperatorId) return
                createInstallMutation.mutate({
                  meterId: installMeter.id,
                  assignedToId: installOperatorId,
                  notes: installNotes || undefined,
                })
              }}
            >
              Kreiraj zadatak
            </Button>
          </div>
        }
      >
        {installMeter && (
          <Space direction="vertical" className="w-full" size="middle">
            <Typography.Text>
              Brojilo: {installMeter.serialNumber}
              {installMeter.simCardState === 'NO_SIM' ? ' – status: Bez kartice' : ''}
            </Typography.Text>
            <Form.Item label="Operator (kojem šaljete zadatak)" required>
              <Select
                placeholder="Odaberite operatora"
                value={installOperatorId || undefined}
                onChange={setInstallOperatorId}
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
                value={installNotes}
                onChange={(e) => setInstallNotes(e.target.value)}
                placeholder="Opcionalno"
              />
            </Form.Item>
          </Space>
        )}
      </Drawer>

      <Drawer
        title="Zadatak demontaže SIM kartice"
        open={demountDrawerOpen}
        width={520}
        onClose={() => {
          setDemountDrawerOpen(false)
          setDemountMeter(null)
          setDemountOperatorId('')
          setDemountNotes('')
        }}
        destroyOnClose
        footer={
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                setDemountDrawerOpen(false)
                setDemountMeter(null)
                setDemountOperatorId('')
                setDemountNotes('')
              }}
            >
              Odustani
            </Button>
            <Button
              type="primary"
              loading={createDemountMutation.isPending}
              onClick={() => {
                if (!demountMeter || !demountOperatorId) return
                createDemountMutation.mutate({
                  meterId: demountMeter.id,
                  assignedToId: demountOperatorId,
                  notes: demountNotes || undefined,
                })
              }}
            >
              Kreiraj zadatak
            </Button>
          </div>
        }
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
      </Drawer>
    </div>
  );
}
