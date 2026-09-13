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
  Tag,
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
import {
  demountTasksApi,
  type DemountCompletionResolution,
  type MeterDemountCategory,
  type RemovedSimDisposition,
} from '@/api/demount-tasks.api';
import { installTasksApi } from '@/api/install-tasks.api';
import InstallationRecordCreateForm from '@/components/installation-records/InstallationRecordCreateForm';
import type {
  CreateMeterInput,
  MeterItem,
  MeterSimCardState,
  MeterType,
  UpdateMeterInput,
} from '@/types/meter.types';
import type { MeterTypeFieldItem } from '@/types/meter-type-field.types'
import type {
  MeterTypeDefinitionItem,
} from '@/types/meter-type-definition.types';
import { buildOsmEmbedUrl } from '@/utils/osm.utils'
import { useTranslation } from '@/i18n';
import {
  getDemountResolutionLabel,
  getMeterDemountCategoryLabel,
  getMeterStatusLabel,
  getRemovedSimDispositionLabel,
} from '@/utils/labels.utils'

function getMeterTypeOptions(t: (key: string) => string): { label: string; value: MeterType }[] {
  return [
    { label: t('meterTypes.phaseSingle'), value: 'SINGLE_PHASE' },
    { label: t('meterTypes.phaseThree'), value: 'THREE_PHASE' },
  ]
}

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
  const { t, language } = useTranslation();
  const dateLocale = language === 'bs' ? 'bs-BA' : 'en-US';
  const meterTypeOptions = getMeterTypeOptions(t)
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [activeTab, setActiveTab] = useState<string>('meters');
  const [pagination, setPagination] = useState(defaultPagination);
  const [filterTypeId, setFilterTypeId] = useState<string | undefined>(undefined);
  const [serialSearchInput, setSerialSearchInput] = useState('');
  const [serialNumberFilter, setSerialNumberFilter] = useState<string | undefined>(undefined);
  const [filterSimCardState, setFilterSimCardState] = useState<MeterSimCardState | undefined>(
    undefined,
  );
  const [meterDrawerOpen, setMeterDrawerOpen] = useState(false);
  const [editingMeter, setEditingMeter] = useState<MeterItem | null>(null);
  const [detailMeter, setDetailMeter] = useState<MeterItem | null>(null);
  const [isQuickDetail, setIsQuickDetail] = useState(false)
  const [demountDrawerOpen, setDemountDrawerOpen] = useState(false);
  const [demountMeter, setDemountMeter] = useState<MeterItem | null>(null);
  const [demountOperatorId, setDemountOperatorId] = useState<string>('');
  const [demountNotes, setDemountNotes] = useState('');
  const [demountResolution, setDemountResolution] = useState<DemountCompletionResolution | ''>('')
  const [demountReason, setDemountReason] = useState('')
  const [demountRemovedSimDisposition, setDemountRemovedSimDisposition] = useState<
    RemovedSimDisposition | ''
  >('')
  const [demountMeterDemountCategory, setDemountMeterDemountCategory] = useState<
    MeterDemountCategory | ''
  >('')
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
    queryKey: ['meters', 'list', pagination, filterTypeId, serialNumberFilter, filterSimCardState],
    queryFn: () =>
      metersApi.list({
        ...pagination,
        meterTypeDefinitionId: filterTypeId,
        serialNumber: serialNumberFilter,
        simCardState: filterSimCardState,
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
    meterTypesQuery.data?.map((mtd) => ({ label: mtd.name, value: mtd.id })) ?? [];

  const operatorsQuery = useQuery({
    queryKey: ['users', 'operators'],
    queryFn: () => usersApi.list({ role: 'USER', limit: 100 }),
    enabled: demountDrawerOpen || installDrawerOpen,
  });

  const createDemountMutation = useMutation({
    mutationFn: (payload: {
      meterId: string
      assignedToId: string
      notes?: string
      requestedResolution: DemountCompletionResolution
      requestedReason: string
      requestedRemovedSimDisposition: RemovedSimDisposition
      requestedMeterDemountCategory?: MeterDemountCategory
    }) => demountTasksApi.create(payload),
    onSuccess: () => {
      messageApi.success(t('meters.demount.taskCreated'));
      setDemountDrawerOpen(false);
      setDemountMeter(null);
      setDemountOperatorId('');
      setDemountNotes('');
      setDemountResolution('')
      setDemountReason('')
      setDemountRemovedSimDisposition('')
      setDemountMeterDemountCategory('')
    },
    onError: (err: unknown) => {
      messageApi.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          t('meters.taskCreateFailed'),
      );
    },
  });

  const createInstallMutation = useMutation({
    mutationFn: (payload: { meterId: string; assignedToId: string; notes?: string }) =>
      installTasksApi.create(payload),
    onSuccess: () => {
      messageApi.success(t('meters.install.taskCreated'));
      setInstallDrawerOpen(false);
      setInstallMeter(null);
      setInstallOperatorId('');
      setInstallNotes('');
    },
    onError: (err: unknown) => {
      messageApi.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          t('meters.taskCreateFailed'),
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
      messageApi.success(t('meters.created'));
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
          : t('meters.createFailed');
      messageApi.error(msg);
    },
  });

  const updateMeterMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateMeterInput }) =>
      metersApi.update(id, payload),
    onSuccess: () => {
      messageApi.success(t('meters.updated'));
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
          : t('meters.updateFailed');
      messageApi.error(msg);
    },
  });

  const deleteTypeMutation = useMutation({
    mutationFn: (id: string) => meterTypeDefinitionsApi.remove(id),
    onSuccess: () => {
      messageApi.success(t('meters.typeDeleted'));
      void queryClient.invalidateQueries({ queryKey: ['meter-type-definitions'] });
    },
    onError: (err: unknown) => {
      messageApi.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          t('meters.typeDeleteFailed'),
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
    setIsQuickDetail(true)
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
      return raw === true || raw === 'true' ? t('common.actions.yes') : t('common.actions.no')
    }
    if (field.fieldType === 'DATE') {
      const d = new Date(String(raw))
      return Number.isNaN(d.getTime()) ? String(raw) : d.toLocaleDateString(dateLocale)
    }
    return String(raw)
  }

  const meterRows = listQuery.data?.items ?? [];
  const typeRows = typesListQuery.data ?? [];
  const recordsForMeter = recordsByMeterQuery.data?.items ?? [];
  const renderType = (mt: MeterType) =>
    mt === 'SINGLE_PHASE' ? t('meterTypes.phaseSingle') : mt === 'THREE_PHASE' ? t('meterTypes.phaseThree') : mt;

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
        {t('layout.sidebar.meters')}
      </Typography.Title>
      <Typography.Paragraph type="secondary" className="!mb-4">
        {t('meters.pageIntro')}
      </Typography.Paragraph>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'meters',
            label: (
              <span>
                <ThunderboltOutlined /> {t('layout.sidebar.meters')}
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
                      placeholder={t('meters.filterByType')}
                      options={meterTypeDefinitionOptions}
                      value={filterTypeId}
                      onChange={setFilterTypeId}
                      style={{ minWidth: 220 }}
                    />
                    <Select
                      allowClear
                      placeholder={t('meters.simOnMeterFilter')}
                      style={{ minWidth: 180 }}
                      value={filterSimCardState}
                      onChange={(v) => {
                        setFilterSimCardState(v);
                        setPagination((p) => ({ ...p, page: 1 }));
                      }}
                      options={[
                        { label: t('meters.noSimOption'), value: 'NO_SIM' },
                        { label: t('meters.simInstalledOption'), value: 'INSTALLED' },
                      ]}
                    />
                    <Input
                      placeholder={t('installationRecords.form.meterSerialLabel')}
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
                      {t('common.actions.search')}
                    </Button>
                    {(serialNumberFilter || filterTypeId || filterSimCardState) && (
                      <Button
                        onClick={() => {
                          setSerialSearchInput('');
                          setSerialNumberFilter(undefined);
                          setFilterTypeId(undefined);
                          setFilterSimCardState(undefined);
                          setPagination(defaultPagination);
                        }}
                      >
                        {t('common.actions.reset')}
                      </Button>
                    )}
                  </Space>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={openMeterCreate}
                    data-tour-id="meters-new-record"
                  >
                    {t('meters.newRecord')}
                  </Button>
                </div>
                {listQuery.isError && (
                  <Typography.Text type="danger">
                    {(listQuery.error as { response?: { data?: { message?: string } } })?.response
                      ?.data?.message ?? t('meters.loadListFailed')}
                  </Typography.Text>
                )}
                <div className="-mx-4 overflow-x-auto px-4">
                  <Table<MeterItem>
                    rowKey="id"
                    loading={listQuery.isLoading}
                    dataSource={meterRows}
                    pagination={{
                      current: listQuery.data?.page,
                      pageSize: listQuery.data?.limit,
                      total: listQuery.data?.total,
                      showSizeChanger: true,
                      showTotal: (total) => t('common.pagination.totalItems', { count: total }),
                      onChange: (page, pageSize) =>
                        setPagination((p) => ({ ...p, page, limit: pageSize ?? 20 })),
                    }}
                    scroll={{ x: 'max-content' }}
                    onRow={(record) => ({
                      onClick: () => openMeterDetail(record),
                      style: { cursor: 'pointer' },
                    })}
                    columns={[
                      {
                        title: t('installationRecords.form.meterSerialLabel'),
                        dataIndex: 'serialNumber',
                        key: 'serialNumber',
                      },
                      {
                        title: t('installationRecords.form.meterTypeLabel'),
                        key: 'meterTypeDefinition',
                        render: (_: unknown, row: MeterItem) =>
                          row.meterTypeDefinition?.name ?? '–',
                      },
                      {
                        title: t('meterTypes.manufacturer'),
                        key: 'manufacturer',
                        render: (_: unknown, row: MeterItem) =>
                          row.meterTypeDefinition?.manufacturer ?? '–',
                      },
                      {
                        title: t('meterTypes.model'),
                        key: 'model',
                        render: (_: unknown, row: MeterItem) =>
                          row.meterTypeDefinition?.model ?? '–',
                      },
                      {
                        title: t('meters.columns.yearShort'),
                        dataIndex: 'year',
                        key: 'year',
                        render: (val: number | null) => (val != null ? String(val) : '–'),
                      },
                      {
                        title: t('meters.columns.calibrationYearShort'),
                        dataIndex: 'calibrationYear',
                        key: 'calibrationYear',
                        render: (val: number | null) => (val != null ? String(val) : '–'),
                      },
                      {
                        title: t('meters.columns.meterStatus'),
                        key: 'meterStatus',
                        width: 160,
                        render: (_: unknown, row: MeterItem) => {
                          const status = row.status ?? 'ACTIVE'
                          const color =
                            status === 'ACTIVE'
                              ? 'success'
                              : status === 'DEFECTIVE'
                                ? 'error'
                                : status === 'IN_CALIBRATION'
                                  ? 'warning'
                                  : 'default'
                          return <Tag color={color}>{getMeterStatusLabel(status, t)}</Tag>
                        },
                      },
                      {
                        title: 'SIM',
                        key: 'sim',
                        width: 130,
                        render: (_: unknown, row: MeterItem) => {
                          const noSim = row.simCardState === 'NO_SIM' || !row.simCard;
                          return (
                            <Tag color={noSim ? 'warning' : 'success'}>
                              {noSim ? t('meters.noSimOption') : t('meters.simInstalledOption')}
                            </Tag>
                          );
                        },
                      },
                      {
                        title: t('meters.columns.demount'),
                        key: 'demountTask',
                        width: 220,
                        render: (_: unknown, row: MeterItem) => {
                          const task = row.demountTasks?.[0]
                          if (!task) return '—'
                          const date = new Date(task.createdAt).toLocaleString(dateLocale)
                          const op = task.assignedTo
                            ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}`
                            : '—'
                          return (
                            <Tag color="gold">
                              {t('meters.columns.orderLabel')} {date} • {op}
                            </Tag>
                          )
                        },
                      },
                      {
                        title: t('common.actions.actions'),
                        key: 'actions',
                        width: 120,
                        render: (_, record) => (
                          <Space onClick={(e) => e.stopPropagation()}>
                            <Button
                              type="link"
                              size="small"
                              onClick={() => navigate(`/meters/${record.id}`)}
                            >
                              {t('common.actions.details')}
                            </Button>
                          </Space>
                        ),
                      },
                    ]}
                    data-tour-id="meters-table"
                  />
                </div>
              </div>
            ),
          },
          {
            key: 'types',
            label: (
              <span>
                <AppstoreOutlined /> {t('layout.sidebar.meterTypes')}
              </span>
            ),
            children: (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <Typography.Text type="secondary">
                    {t('meters.typesCatalogIntro')}
                  </Typography.Text>
                  {userRole === 'SYSTEM_ADMIN' && (
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={openTypeCreate}
                      data-tour-id="meters-new-type"
                    >
                      {t('meterTypes.newTitle')}
                    </Button>
                  )}
                </div>
                <div className="-mx-4 overflow-x-auto px-4">
                  <Table<MeterTypeDefinitionItem>
                    rowKey="id"
                    loading={typesListQuery.isLoading}
                    dataSource={typeRows}
                    pagination={false}
                    scroll={{ x: 'max-content' }}
                    columns={[
                      { title: t('common.labels.name'), dataIndex: 'name', key: 'name' },
                      {
                        title: t('meterTypes.manufacturer'),
                        dataIndex: 'manufacturer',
                        key: 'manufacturer',
                        render: (v: string | null) => v ?? '–',
                      },
                      {
                        title: t('meterTypes.model'),
                        dataIndex: 'model',
                        key: 'model',
                        render: (v: string | null) => v ?? '–',
                      },
                      {
                        title: t('common.labels.type'),
                        dataIndex: 'type',
                        key: 'type',
                        render: (mt: MeterType) => renderType(mt),
                      },
                      {
                        title: t('meters.columns.maxCurrent'),
                        dataIndex: 'maxCurrent',
                        key: 'maxCurrent',
                        render: (v: string | null) => v ?? '–',
                      },
                      {
                        title: t('common.actions.actions'),
                        key: 'actions',
                        width: 160,
                        render: (_, record) => (
                          <Space>
                            {userRole === 'SYSTEM_ADMIN' ? (
                              <>
                                <Button type="link" size="small" onClick={() => openTypeEdit(record)}>
                                  {t('common.actions.edit')}
                                </Button>
                                <Popconfirm
                                  title={t('meters.confirmDeleteType')}
                                  onConfirm={() => deleteTypeMutation.mutate(record.id)}
                                  okText={t('common.actions.yes')}
                                  cancelText={t('common.actions.no')}
                                  okButtonProps={{ danger: true }}
                                >
                                  <Button
                                    type="link"
                                    size="small"
                                    danger
                                    disabled={deleteTypeMutation.isPending}
                                  >
                                    {t('common.actions.delete')}
                                  </Button>
                                </Popconfirm>
                              </>
                            ) : (
                              <Button type="link" size="small" onClick={() => openTypeEdit(record)}>
                                {t('common.actions.details')}
                              </Button>
                            )}
                          </Space>
                        ),
                      },
                    ]}
                    data-tour-id="meters-types-table"
                  />
                </div>
              </div>
            ),
          },
        ]}
      />

      <Drawer
        title={t('meters.meterDrawerTitle', { serial: detailMeter?.serialNumber ?? '' })}
        placement="right"
        width={480}
        open={Boolean(detailMeter)}
        onClose={() => {
          setDetailMeter(null)
          setIsQuickDetail(false)
        }}
      >
        {detailMeter && (
          <>
            <Descriptions column={1} size="small" bordered className="mb-4">
              <Descriptions.Item label={t('installationRecords.form.meterSerialLabel')}>{detailMeter.serialNumber}</Descriptions.Item>
              <Descriptions.Item label={t('installationRecords.form.meterTypeLabel')}>
                {detailMeter.meterTypeDefinition?.name ?? '–'}
              </Descriptions.Item>
              <Descriptions.Item label={t('meterTypes.manufacturer')}>
                {detailMeter.meterTypeDefinition?.manufacturer ?? '–'}
              </Descriptions.Item>
              <Descriptions.Item label={t('meterTypes.model')}>
                {detailMeter.meterTypeDefinition?.model ?? '–'}
              </Descriptions.Item>
              <Descriptions.Item label={t('meterTypes.phaseColumn')}>
                {detailMeter.meterTypeDefinition?.type
                  ? renderType(detailMeter.meterTypeDefinition.type)
                  : '–'}
              </Descriptions.Item>
              <Descriptions.Item label={t('meterTypes.maxCurrent')}>
                {detailMeter.meterTypeDefinition?.maxCurrent ?? '–'}
              </Descriptions.Item>
              <Descriptions.Item label={t('installationRecords.form.yearLabel')}>
                {detailMeter.year != null ? String(detailMeter.year) : '–'}
              </Descriptions.Item>
              <Descriptions.Item label={t('installationRecords.form.calibrationYearLabel')}>
                {detailMeter.calibrationYear != null ? String(detailMeter.calibrationYear) : '–'}
              </Descriptions.Item>
              <Descriptions.Item label={t('installationRecords.detail.installationLocationLabel')}>
                {(detailMeter as MeterItem & { installationAddress?: string }).installationAddress ?? '–'}
              </Descriptions.Item>
              <Descriptions.Item label={t('installationRecords.list.columns.installationDate')}>
                {(detailMeter as MeterItem & { installationDate?: string })?.installationDate?.slice(0, 10) ?? '–'}
              </Descriptions.Item>
              <Descriptions.Item label={t('installationRecords.form.measuringPointLabel')}>
                {(detailMeter as MeterItem & { measuringPoint?: string }).measuringPoint ?? '–'}
              </Descriptions.Item>
              {((detailMeter as MeterItem).latitude != null || (detailMeter as MeterItem).longitude != null) && (
                <>
                  <Descriptions.Item label={t('installationRecords.form.gpsLatLabel')}>
                    {(detailMeter as MeterItem).latitude != null
                      ? String((detailMeter as MeterItem).latitude)
                      : '–'}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('installationRecords.form.gpsLngLabel')}>
                    {(detailMeter as MeterItem).longitude != null
                      ? String((detailMeter as MeterItem).longitude)
                      : '–'}
                  </Descriptions.Item>
                </>
              )}
              <Descriptions.Item label={t('common.labels.notes')}>
                {detailMeter.notes ?? '–'}
              </Descriptions.Item>
              <Descriptions.Item label={t('installationRecords.detail.simStatusLabel')}>
                {detailMeter.simCardState === 'NO_SIM' || !detailMeter.simCard
                  ? `${t('installationRecords.detail.simNone')}${detailMeter.noSimReason ? ` (${detailMeter.noSimReason})` : ''}`
                  : t('meters.simInstalledShort')}
              </Descriptions.Item>
              {(detailMeter as MeterItem & { simCard?: { id: string; iccid: string; ipAddress?: string } }).simCard && (
                <>
                  <Descriptions.Item label={t('simCards.details.ipAddress')}>
                    {(detailMeter as MeterItem & { simCard?: { ipAddress?: string } }).simCard?.ipAddress ?? '–'}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('meters.installedSimCardLabel')}>
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
          </>
        )}
      </Drawer>

      <Drawer
        title={editingMeter ? t('meters.editMeter') : t('meters.newRecord')}
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
                {t('common.actions.cancel')}
              </Button>
              <Button
                type="primary"
                loading={updateMeterMutation.isPending}
                onClick={() => meterForm.submit()}
              >
                {t('common.actions.save')}
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
              label={t('installationRecords.form.meterSerialLabel')}
              rules={[{ required: true, message: t('installationRecords.form.serialNumberRequired') }]}
            >
              <Input placeholder="npr. AMM-12345" />
            </Form.Item>
            <Form.Item
              name="meterTypeDefinitionId"
              label={t('meters.meterTypeCatalogLabel')}
              rules={[{ required: true, message: t('installationRecords.form.meterTypeRequired') }]}
            >
              <Select
                placeholder={t('meters.selectFromCatalogPlaceholder')}
                options={meterTypeDefinitionOptions}
                loading={meterTypesQuery.isLoading}
              />
            </Form.Item>
            <Form.Item
              name="year"
              label={t('installationRecords.form.yearLabel')}
              rules={[{ required: true, message: t('installationRecords.form.requiredShort') }]}
            >
              <InputNumber min={1970} max={2100} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              name="calibrationYear"
              label={t('installationRecords.form.calibrationYearLabel')}
              rules={[{ required: true, message: t('installationRecords.form.requiredShort') }]}
            >
              <InputNumber min={1970} max={2100} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="installationAddress" label={t('installationRecords.detail.installationLocationLabel')}>
              <Input.TextArea rows={2} placeholder={t('installationRecords.form.addressPlaceholder')} />
            </Form.Item>
            <Form.Item name="installationDate" label={t('installationRecords.list.columns.installationDate')}>
              <Input type="date" placeholder="YYYY-MM-DD" />
            </Form.Item>
            <Form.Item name="city" label={t('meters.cityPlaceLabel')}>
              <Input placeholder={t('common.labels.optional')} />
            </Form.Item>
            <Form.Item name="municipality" label={t('installationRecords.form.municipalityLabel')}>
              <Input placeholder={t('common.labels.optional')} />
            </Form.Item>
            <Form.Item name="measuringPoint" label={t('meters.measuringPointMMLabel')}>
              <Input placeholder={t('common.labels.optional')} />
            </Form.Item>
            <Form.Item name="notes" label={t('common.labels.notes')}>
              <Input.TextArea rows={2} placeholder={t('common.labels.optional')} />
            </Form.Item>

            {selectedEditMeterTypeDefinitionId && (
              <div className="rounded-md border border-slate-200 p-3">
                <div className="font-medium mb-2">{t('installationRecords.form.extraFields')}</div>
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
                          ? [{ required: true, message: t('installationRecords.form.fieldRequired', { label: field.label }) }]
                          : []
                      }
                    >
                      {renderDynamicFieldInput(field)}
                    </Form.Item>
                  ))}
                {meterTypeFieldsQuery.isLoading && (
                  <div className="text-sm text-slate-500">{t('installationRecords.form.loadingFields')}</div>
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
        title={t('meters.install.drawerTitle')}
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
              {t('common.actions.cancel')}
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
              {t('meters.createTaskButton')}
            </Button>
          </div>
        }
      >
        {installMeter && (
          <Space direction="vertical" className="w-full" size="middle">
            <Typography.Text>
              {t('meters.meterColonLabel')} {installMeter.serialNumber}
              {installMeter.simCardState === 'NO_SIM' ? ` – ${t('meters.statusNoCardSuffix')}` : ''}
            </Typography.Text>
            <Form.Item label={t('meters.operatorFieldLabel')} required>
              <Select
                placeholder={t('meters.selectOperatorPlaceholder')}
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
            <Form.Item label={t('common.labels.notes')}>
              <Input.TextArea
                rows={2}
                value={installNotes}
                onChange={(e) => setInstallNotes(e.target.value)}
                placeholder={t('common.labels.optional')}
              />
            </Form.Item>
          </Space>
        )}
      </Drawer>

      <Drawer
        title={t('meters.demount.drawerTitle')}
        open={demountDrawerOpen}
        width={520}
        onClose={() => {
          setDemountDrawerOpen(false)
          setDemountMeter(null)
          setDemountOperatorId('')
          setDemountNotes('')
          setDemountResolution('')
          setDemountReason('')
          setDemountRemovedSimDisposition('')
          setDemountMeterDemountCategory('')
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
              {t('common.actions.cancel')}
            </Button>
            <Button
              type="primary"
              loading={createDemountMutation.isPending}
              onClick={() => {
                if (!demountMeter || !demountOperatorId) return
                if (!demountResolution) return
                if (demountReason.trim().length < 3) return
                if (!demountRemovedSimDisposition) return
                if (
                  (demountResolution === 'FULL_DEMOUNT' ||
                    demountResolution === 'REMOVE_SIM_ONLY') &&
                  !demountMeterDemountCategory
                )
                  return
                createDemountMutation.mutate({
                  meterId: demountMeter.id,
                  assignedToId: demountOperatorId,
                  notes: demountNotes || undefined,
                  requestedResolution: demountResolution,
                  requestedReason: demountReason.trim(),
                  requestedRemovedSimDisposition: demountRemovedSimDisposition,
                  ...(demountResolution === 'FULL_DEMOUNT' ||
                  demountResolution === 'REMOVE_SIM_ONLY'
                    ? {
                        requestedMeterDemountCategory:
                          demountMeterDemountCategory as MeterDemountCategory,
                      }
                    : {}),
                })
              }}
            >
              {t('meters.createTaskButton')}
            </Button>
          </div>
        }
      >
        {demountMeter && (
          <Space direction="vertical" className="w-full" size="middle">
            <Typography.Text>
              {t('meters.meterColonLabel')} {demountMeter.serialNumber}
              {demountMeter.simCard ? ` – SIM: ${demountMeter.simCard.iccid}` : ''}
            </Typography.Text>
            <Form.Item label={t('meters.operatorFieldLabel')} required>
              <Select
                placeholder={t('meters.selectOperatorPlaceholder')}
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
            <Form.Item label={t('common.labels.notes')}>
              <Input.TextArea
                rows={2}
                value={demountNotes}
                onChange={(e) => setDemountNotes(e.target.value)}
                placeholder={t('common.labels.optional')}
              />
            </Form.Item>

            <Form.Item label={t('meters.demount.resolutionLabel')} required>
              <Select
                placeholder={t('meters.demount.selectResolutionPlaceholder')}
                value={demountResolution || undefined}
                onChange={(v) => {
                  setDemountResolution(v)
                  if (v === 'REPLACE_SIM') setDemountMeterDemountCategory('')
                }}
                options={(
                  ['FULL_DEMOUNT', 'REPLACE_SIM', 'REMOVE_SIM_ONLY'] as DemountCompletionResolution[]
                ).map((v) => ({
                  label: getDemountResolutionLabel(v, t),
                  value: v,
                }))}
              />
            </Form.Item>

            <Form.Item label={t('meters.demount.removedSimOutcomeLabel')} required>
              <Select
                placeholder={t('meters.demount.selectRemovedSimOutcomePlaceholder')}
                value={demountRemovedSimDisposition || undefined}
                onChange={setDemountRemovedSimDisposition}
                options={(['MARK_DEFECTIVE', 'RETURN_TO_STOCK'] as RemovedSimDisposition[]).map(
                  (v) => ({
                    label: getRemovedSimDispositionLabel(v, t),
                    value: v,
                  }),
                )}
              />
            </Form.Item>

            {demountResolution === 'FULL_DEMOUNT' || demountResolution === 'REMOVE_SIM_ONLY' ? (
              <Form.Item label={t('meters.demount.categoryLabel')} required>
                <Select
                  placeholder={t('meters.demount.selectCategoryPlaceholder')}
                  value={demountMeterDemountCategory || undefined}
                  onChange={setDemountMeterDemountCategory}
                  options={(
                    [
                      'METER_FAULTY',
                      'TEMPORARY_REMOVAL',
                      'MAINTENANCE',
                      'OTHER',
                    ] as MeterDemountCategory[]
                  ).map((v) => ({
                    label: getMeterDemountCategoryLabel(v, t),
                    value: v,
                  }))}
                />
              </Form.Item>
            ) : null}

            <Form.Item
              label={t('meters.demount.reasonLabel')}
              required
              validateStatus={demountReason.trim().length >= 3 ? undefined : 'error'}
              help={demountReason.trim().length >= 3 ? undefined : t('meters.demount.minCharsHelp')}
            >
              <Input.TextArea
                rows={3}
                value={demountReason}
                onChange={(e) => setDemountReason(e.target.value)}
                placeholder={t('meters.demount.reasonPlaceholder')}
              />
            </Form.Item>
          </Space>
        )}
      </Drawer>
    </div>
  );
}
