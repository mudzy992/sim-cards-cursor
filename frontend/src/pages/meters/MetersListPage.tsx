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
import { PageHeader, StatusBadge, getMeterStatusTone } from '@/components/ui';
import { useState } from 'react';
import { PlusOutlined, ThunderboltOutlined, AppstoreOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { metersApi } from '@/api/meters.api';
import { branchesApi } from '@/api/branches.api';
import { usersApi } from '@/api/users.api';
import { meterTypeDefinitionsApi } from '@/api/meter-type-definitions.api';
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
  MeterStatus,
  MeterType,
  UpdateMeterInput,
} from '@/types/meter.types';
import type { MeterTypeFieldItem } from '@/types/meter-type-field.types'
import type {
  MeterTypeDefinitionItem,
} from '@/types/meter-type-definition.types';
import { useTranslation } from '@/i18n';
import { getApiErrorMessage } from '@/utils/error.utils';
import {
  getDemountResolutionLabel,
  getMeterDemountCategoryLabel,
  getMeterStatusLabel,
  getRemovedSimDispositionLabel,
} from '@/utils/labels.utils'

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
  dynamicFieldValues?: Record<string, unknown>;
};

const defaultPagination = { page: 1, limit: 20 };

export default function MetersListPage() {
  const { t, language } = useTranslation();
  const dateLocale = language === 'bs' ? 'bs-BA' : 'en-US';
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
  const [filterStatus, setFilterStatus] = useState<MeterStatus | undefined>(undefined);
  const [filterBranchId, setFilterBranchId] = useState<string | undefined>(undefined);
  const [meterDrawerOpen, setMeterDrawerOpen] = useState(false);
  const [editingMeter, setEditingMeter] = useState<MeterItem | null>(null);
  const [detailMeter, setDetailMeter] = useState<MeterItem | null>(null);
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
  const [selectedMeters, setSelectedMeters] = useState<MeterItem[]>([]);
  const [bulkInstallMode, setBulkInstallMode] = useState(false);
  const [bulkDemountMode, setBulkDemountMode] = useState(false);

  const [meterForm] = Form.useForm<MeterFormValues>();
  const userRole = useAuthStore((s) => s.user?.role);

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
    queryKey: [
      'meters',
      'list',
      pagination,
      filterTypeId,
      serialNumberFilter,
      filterSimCardState,
      filterStatus,
      filterBranchId,
    ],
    queryFn: () =>
      metersApi.list({
        ...pagination,
        meterTypeDefinitionId: filterTypeId,
        serialNumber: serialNumberFilter,
        simCardState: filterSimCardState,
        status: filterStatus,
        branchId: filterBranchId,
      }),
  });

  const branchesQuery = useQuery({
    queryKey: ['branches', 'list', 'for-meters-filter'],
    queryFn: () => branchesApi.list(),
    enabled: userRole === 'SYSTEM_ADMIN' || userRole === 'DIST_ADMIN',
  });

  const branchOptions =
    branchesQuery.data?.map((b) => ({
      label: b.code ? `${b.name} (${b.code})` : b.name,
      value: b.id,
    })) ?? [];

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
      messageApi.error(getApiErrorMessage(err, t('meters.taskCreateFailed')));
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
      messageApi.error(getApiErrorMessage(err, t('meters.taskCreateFailed')));
    },
  });

  const bulkInstallMutation = useMutation({
    mutationFn: (payload: { meterIds: string[]; assignedToId: string; notes?: string }) =>
      installTasksApi.createBulk(payload),
    onSuccess: (res) => {
      if (res.failedCount > 0) {
        messageApi.warning(
          t('meters.bulk.resultPartial', {
            created: res.createdCount,
            total: res.totalRequested,
            failed: res.failedCount,
          }),
        );
      } else {
        messageApi.success(t('meters.bulk.resultSuccess', { created: res.createdCount }));
      }
      setInstallDrawerOpen(false);
      setBulkInstallMode(false);
      setInstallOperatorId('');
      setInstallNotes('');
      setSelectedMeters([]);
      void queryClient.invalidateQueries({ queryKey: ['meters', 'list'] });
    },
    onError: (err: unknown) => {
      messageApi.error(getApiErrorMessage(err, t('meters.taskCreateFailed')));
    },
  });

  const bulkDemountMutation = useMutation({
    mutationFn: (payload: {
      meterIds: string[];
      assignedToId: string;
      notes?: string;
      requestedResolution: DemountCompletionResolution;
      requestedReason: string;
      requestedRemovedSimDisposition: RemovedSimDisposition;
      requestedMeterDemountCategory?: MeterDemountCategory;
    }) => demountTasksApi.createBulk(payload),
    onSuccess: (res) => {
      if (res.failedCount > 0) {
        messageApi.warning(
          t('meters.bulk.resultPartial', {
            created: res.createdCount,
            total: res.totalRequested,
            failed: res.failedCount,
          }),
        );
      } else {
        messageApi.success(t('meters.bulk.resultSuccess', { created: res.createdCount }));
      }
      setDemountDrawerOpen(false);
      setBulkDemountMode(false);
      setDemountOperatorId('');
      setDemountNotes('');
      setDemountResolution('');
      setDemountReason('');
      setDemountRemovedSimDisposition('');
      setDemountMeterDemountCategory('');
      setSelectedMeters([]);
      void queryClient.invalidateQueries({ queryKey: ['meters', 'list'] });
    },
    onError: (err: unknown) => {
      messageApi.error(getApiErrorMessage(err, t('meters.taskCreateFailed')));
    },
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
      messageApi.error(getApiErrorMessage(err, t('meters.createFailed')));
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
      messageApi.error(getApiErrorMessage(err, t('meters.updateFailed')));
    },
  });

  const deleteTypeMutation = useMutation({
    mutationFn: (id: string) => meterTypeDefinitionsApi.remove(id),
    onSuccess: () => {
      messageApi.success(t('meters.typeDeleted'));
      void queryClient.invalidateQueries({ queryKey: ['meter-type-definitions'] });
    },
    onError: (err: unknown) => {
      messageApi.error(getApiErrorMessage(err, t('meters.typeDeleteFailed')));
    },
  });

  function openMeterCreate() {
    setEditingMeter(null);
    meterForm.resetFields();
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
  const eligibleInstallMeters = selectedMeters.filter(
    (m) => m.simCardState === 'NO_SIM' && !m.simCard && (m.status ?? 'ACTIVE') === 'ACTIVE',
  );
  const eligibleDemountMeters = selectedMeters.filter(
    (m) => m.simCardState === 'INSTALLED' && Boolean(m.simCard) && (m.status ?? 'ACTIVE') === 'ACTIVE',
  );
  const renderType = (mt: MeterType) =>
    mt === 'SINGLE_PHASE' ? t('meterTypes.phaseSingle') : mt === 'THREE_PHASE' ? t('meterTypes.phaseThree') : mt;

  return (
    <div
      className="space-y-4"
      data-tour-id="admin-meters"
      data-tour-role="SYSTEM_ADMIN DIST_ADMIN"
    >
      {messageContextHolder}
      <PageHeader
        title={t('layout.sidebar.meters')}
        subtitle={t('meters.pageIntro')}
      />

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
                      onChange={(v) => {
                        setFilterTypeId(v);
                        setPagination((p) => ({ ...p, page: 1 }));
                      }}
                      style={{ minWidth: 220 }}
                    />
                    <Select
                      allowClear
                      placeholder={t('meters.simOnMeterFilter')}
                      style={{ minWidth: 160 }}
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
                    <Select
                      allowClear
                      placeholder={t('meters.filterByStatus')}
                      style={{ minWidth: 170 }}
                      value={filterStatus}
                      onChange={(v) => {
                        setFilterStatus(v);
                        setPagination((p) => ({ ...p, page: 1 }));
                      }}
                      options={(['ACTIVE', 'DEFECTIVE', 'INACTIVE', 'IN_CALIBRATION'] as MeterStatus[]).map(
                        (s) => ({
                          label: getMeterStatusLabel(s, t),
                          value: s,
                        }),
                      )}
                    />
                    {(userRole === 'SYSTEM_ADMIN' || userRole === 'DIST_ADMIN') && (
                      <Select
                        allowClear
                        showSearch
                        optionFilterProp="label"
                        placeholder={t('meters.filterByBranch')}
                        style={{ minWidth: 190 }}
                        value={filterBranchId}
                        onChange={(v) => {
                          setFilterBranchId(v);
                          setPagination((p) => ({ ...p, page: 1 }));
                        }}
                        options={branchOptions}
                        loading={branchesQuery.isLoading}
                      />
                    )}
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
                    {(serialNumberFilter ||
                      filterTypeId ||
                      filterSimCardState ||
                      filterStatus ||
                      filterBranchId) && (
                      <Button
                        onClick={() => {
                          setSerialSearchInput('');
                          setSerialNumberFilter(undefined);
                          setFilterTypeId(undefined);
                          setFilterSimCardState(undefined);
                          setFilterStatus(undefined);
                          setFilterBranchId(undefined);
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
                {selectedMeters.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-subtle bg-surface-muted px-4 py-2.5">
                    <Typography.Text strong>
                      {t('meters.bulk.selectedCount', { count: selectedMeters.length })}
                    </Typography.Text>
                    <Space wrap>
                      <Button
                        type="primary"
                        disabled={eligibleInstallMeters.length === 0}
                        onClick={() => {
                          setInstallMeter(null);
                          setBulkInstallMode(true);
                          setInstallDrawerOpen(true);
                        }}
                      >
                        {t('meters.bulk.assignInstall', { count: eligibleInstallMeters.length })}
                      </Button>
                      <Button
                        disabled={eligibleDemountMeters.length === 0}
                        onClick={() => {
                          setDemountMeter(null);
                          setBulkDemountMode(true);
                          setDemountDrawerOpen(true);
                        }}
                      >
                        {t('meters.bulk.assignDemount', { count: eligibleDemountMeters.length })}
                      </Button>
                      <Button type="text" onClick={() => setSelectedMeters([])}>
                        {t('meters.bulk.clearSelection')}
                      </Button>
                    </Space>
                  </div>
                )}
                <div className="-mx-4 overflow-x-auto px-4">
                  <Table<MeterItem>
                    rowKey="id"
                    loading={listQuery.isLoading}
                    dataSource={meterRows}
                    rowSelection={{
                      selectedRowKeys: selectedMeters.map((m) => m.id),
                      onChange: (_keys, rows) => setSelectedMeters(rows),
                    }}
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
                        title: t('meters.columns.branch'),
                        key: 'branch',
                        render: (_: unknown, row: MeterItem) => row.branch?.name ?? '–',
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
                          return (
                            <StatusBadge
                              tone={getMeterStatusTone(status)}
                              label={getMeterStatusLabel(status, t)}
                            />
                          )
                        },
                      },
                      {
                        title: 'SIM',
                        key: 'sim',
                        width: 130,
                        render: (_: unknown, row: MeterItem) => {
                          const noSim = row.simCardState === 'NO_SIM' || !row.simCard;
                          return (
                            <StatusBadge
                              tone={noSim ? 'warning' : 'success'}
                              label={noSim ? t('meters.noSimOption') : t('meters.simInstalledOption')}
                            />
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
                            <StatusBadge
                              tone="warning"
                              label={`${t('meters.columns.orderLabel')} ${date} • ${op}`}
                            />
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
                        title: t('meters.columns.metersCount'),
                        key: 'metersCount',
                        width: 120,
                        render: (_: unknown, record) => record._count?.meters ?? 0,
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
              <Input placeholder={t('common.placeholders.meterSerialExample')} />
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
              <Input type="date" placeholder={t('common.placeholders.dateFormat')} />
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
              <div className="rounded-md border border-subtle p-3">
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
                  <div className="text-sm text-fg-secondary">{t('installationRecords.form.loadingFields')}</div>
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
        title={
          bulkInstallMode
            ? t('meters.bulk.installDrawerTitle', { count: eligibleInstallMeters.length })
            : t('meters.install.drawerTitle')
        }
        open={installDrawerOpen}
        width={520}
        onClose={() => {
          setInstallDrawerOpen(false)
          setBulkInstallMode(false)
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
                setBulkInstallMode(false)
                setInstallMeter(null)
                setInstallOperatorId('')
                setInstallNotes('')
              }}
            >
              {t('common.actions.cancel')}
            </Button>
            <Button
              type="primary"
              loading={createInstallMutation.isPending || bulkInstallMutation.isPending}
              disabled={
                !installOperatorId ||
                (bulkInstallMode ? eligibleInstallMeters.length === 0 : !installMeter)
              }
              onClick={() => {
                if (!installOperatorId) return
                if (bulkInstallMode) {
                  bulkInstallMutation.mutate({
                    meterIds: eligibleInstallMeters.map((m) => m.id),
                    assignedToId: installOperatorId,
                    notes: installNotes || undefined,
                  })
                  return
                }
                if (!installMeter) return
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
        {(installMeter || bulkInstallMode) && (
          <Space direction="vertical" className="w-full" size="middle">
            {bulkInstallMode ? (
              <Typography.Text>
                {t('meters.bulk.eligibleMetersHint', { count: eligibleInstallMeters.length })}
              </Typography.Text>
            ) : installMeter ? (
              <Typography.Text>
                {t('meters.meterColonLabel')} {installMeter.serialNumber}
                {installMeter.simCardState === 'NO_SIM' ? ` – ${t('meters.statusNoCardSuffix')}` : ''}
              </Typography.Text>
            ) : null}
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
        title={
          bulkDemountMode
            ? t('meters.bulk.demountDrawerTitle', { count: eligibleDemountMeters.length })
            : t('meters.demount.drawerTitle')
        }
        open={demountDrawerOpen}
        width={520}
        onClose={() => {
          setDemountDrawerOpen(false)
          setBulkDemountMode(false)
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
                setBulkDemountMode(false)
                setDemountMeter(null)
                setDemountOperatorId('')
                setDemountNotes('')
              }}
            >
              {t('common.actions.cancel')}
            </Button>
            <Button
              type="primary"
              loading={createDemountMutation.isPending || bulkDemountMutation.isPending}
              disabled={
                !demountOperatorId ||
                !demountResolution ||
                demountReason.trim().length < 3 ||
                !demountRemovedSimDisposition ||
                ((demountResolution === 'FULL_DEMOUNT' ||
                  demountResolution === 'REMOVE_SIM_ONLY') &&
                  !demountMeterDemountCategory) ||
                (bulkDemountMode ? eligibleDemountMeters.length === 0 : !demountMeter)
              }
              onClick={() => {
                if (!demountOperatorId) return
                if (!demountResolution) return
                if (demountReason.trim().length < 3) return
                if (!demountRemovedSimDisposition) return
                if (
                  (demountResolution === 'FULL_DEMOUNT' ||
                    demountResolution === 'REMOVE_SIM_ONLY') &&
                  !demountMeterDemountCategory
                )
                  return
                if (bulkDemountMode) {
                  bulkDemountMutation.mutate({
                    meterIds: eligibleDemountMeters.map((m) => m.id),
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
                  return
                }
                if (!demountMeter) return
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
        {(demountMeter || bulkDemountMode) && (
          <Space direction="vertical" className="w-full" size="middle">
            {bulkDemountMode ? (
              <Typography.Text>
                {t('meters.bulk.eligibleMetersHint', { count: eligibleDemountMeters.length })}
              </Typography.Text>
            ) : demountMeter ? (
              <Typography.Text>
                {t('meters.meterColonLabel')} {demountMeter.serialNumber}
                {demountMeter.simCard ? ` – SIM: ${demountMeter.simCard.iccid}` : ''}
              </Typography.Text>
            ) : null}
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
