import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Card,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Radio,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
  message,
} from 'antd'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { metersApi } from '@/api/meters.api'
import { usersApi } from '@/api/users.api'
import { installationRecordsApi } from '@/api/installation-records.api'
import {
  demountTasksApi,
  type DemountCompletionResolution,
  type MeterDemountCategory,
  type RemovedSimDisposition,
} from '@/api/demount-tasks.api'
import { installTasksApi } from '@/api/install-tasks.api'
import { meterTypeDefinitionsApi } from '@/api/meter-type-definitions.api'
import { buildOsmEmbedUrl } from '@/utils/osm.utils'
import { useAuthStore } from '@/store/auth.store'
import { useTranslation } from '@/i18n'
import {
  getDemountResolutionLabel,
  getMeterDemountCategoryLabel,
  getRemovedSimDispositionLabel,
} from '@/utils/labels.utils'
import type { MeterStatus, MeterType, UpdateMeterInput } from '@/types/meter.types'
import type {
  DeleteMeterWithConfirmInput,
  MeterDeleteRecordsAction,
  MeterDeleteSimAction,
} from '@/types/meter.types'
import type { MeterTypeFieldItem } from '@/types/meter-type-field.types'
import type { UserRole } from '@/types/auth.types'

function renderType(mt: MeterType, t: (key: string) => string) {
  return mt === 'SINGLE_PHASE' ? t('meterTypes.phaseSingle') : mt === 'THREE_PHASE' ? t('meterTypes.phaseThree') : mt
}

function meterStatusLabel(s: MeterStatus, t: (key: string) => string) {
  if (s === 'ACTIVE') return t('labels.meterStatus.active')
  if (s === 'DEFECTIVE') return t('labels.meterStatus.defective')
  if (s === 'INACTIVE') return t('labels.meterStatus.inactive')
  return t('labels.meterStatus.inCalibration')
}

type MeterFormValues = {
  serialNumber: string
  meterTypeDefinitionId: string
  status?: MeterStatus
  year?: number
  calibrationYear?: number
  notes?: string
  installationAddress?: string
  installationDate?: string
  city?: string
  municipality?: string
  measuringPoint?: string
  dynamicFieldValues?: Record<string, {}>
}

export default function MeterDetailPage() {
  const { t, language } = useTranslation()
  const dateLocale = language === 'bs' ? 'bs-BA' : 'en-US'
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [messageApi, messageContextHolder] = message.useMessage()
  const { id } = useParams<{ id: string }>()
  const user = useAuthStore((s) => s.user)
  const userRole = (user?.role ?? null) as UserRole | null

  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteSimAction, setDeleteSimAction] = useState<MeterDeleteSimAction>('LEAVE_AS_IS')
  const [deleteRecordsAction, setDeleteRecordsAction] =
    useState<MeterDeleteRecordsAction>('ABORT_IF_EXISTS')

  const [installDrawerOpen, setInstallDrawerOpen] = useState(false)
  const [demountDrawerOpen, setDemountDrawerOpen] = useState(false)
  const [editDrawerOpen, setEditDrawerOpen] = useState(false)
  const [reassignDrawerOpen, setReassignDrawerOpen] = useState(false)
  const [reassignTask, setReassignTask] = useState<{ kind: 'INSTALL' | 'DEMOUNT'; taskId: string } | null>(null)
  const [installOperatorId, setInstallOperatorId] = useState<string>('')
  const [demountOperatorId, setDemountOperatorId] = useState<string>('')
  const [installNotes, setInstallNotes] = useState('')
  const [demountNotes, setDemountNotes] = useState('')
  const [reassignOperatorId, setReassignOperatorId] = useState<string>('')
  const [demountResolution, setDemountResolution] = useState<DemountCompletionResolution | ''>('')
  const [demountReason, setDemountReason] = useState('')
  const [demountRemovedSimDisposition, setDemountRemovedSimDisposition] = useState<
    RemovedSimDisposition | ''
  >('')
  const [demountMeterDemountCategory, setDemountMeterDemountCategory] = useState<
    MeterDemountCategory | ''
  >('')
  const [meterForm] = Form.useForm<MeterFormValues>()

  const meterQuery = useQuery({
    queryKey: ['meters', 'detail', id],
    queryFn: () => metersApi.get(id!),
    enabled: Boolean(id),
  })

  const meter = meterQuery.data
  const openInstallTask = meter?.installTasks?.[0]
  const openDemountTask = meter?.demountTasks?.[0]
  const moderatedBranchIds = user?.branchModeratorBranchIds ?? []
  const isAdmin = userRole === 'SYSTEM_ADMIN' || userRole === 'DIST_ADMIN'
  const isModeratorForMeter = Boolean(meter?.branchId) && moderatedBranchIds.includes(meter!.branchId!)
  const canCreateTasksForMeter = isAdmin || isModeratorForMeter
  const canCreateInstallTask =
    canCreateTasksForMeter &&
    Boolean(meter) &&
    (meter!.simCardState === 'NO_SIM' || !meter!.simCard) &&
    !openInstallTask
  const canCreateDemountTask =
    canCreateTasksForMeter && Boolean(meter) && Boolean(meter!.simCard) && !openDemountTask
  const isActiveMeter = !meter?.status || meter.status === 'ACTIVE'
  const openInstallLabel = openInstallTask
    ? {
        date: new Date(openInstallTask.createdAt).toLocaleString(dateLocale),
        operator: openInstallTask.assignedTo
          ? `${openInstallTask.assignedTo.firstName} ${openInstallTask.assignedTo.lastName}`
          : '–',
        status:
          openInstallTask.status === 'IN_PROGRESS'
            ? t('meters.detail.statusInProgress')
            : openInstallTask.status === 'PENDING'
              ? t('meters.detail.statusWaiting')
              : openInstallTask.status,
      }
    : null

  const openDemountLabel = openDemountTask
    ? {
        date: new Date(openDemountTask.createdAt).toLocaleString(dateLocale),
        operator: openDemountTask.assignedTo
          ? `${openDemountTask.assignedTo.firstName} ${openDemountTask.assignedTo.lastName}`
          : '–',
        resolution: openDemountTask.requestedResolution
          ? getDemountResolutionLabel(openDemountTask.requestedResolution, t)
          : '–',
      }
    : null

  const recordsQuery = useQuery({
    queryKey: ['installation-records', 'by-meter', id],
    queryFn: () =>
      installationRecordsApi.list({
        page: 1,
        limit: 50,
        meterId: id,
      }),
    enabled: Boolean(id),
  })

  const deleteSummaryQuery = useQuery({
    queryKey: ['meters', 'delete-summary', id],
    queryFn: () => metersApi.getDeleteSummary(id!),
    enabled: Boolean(id) && deleteModalOpen && userRole === 'SYSTEM_ADMIN',
  })

  const deleteWithConfirmMutation = useMutation({
    mutationFn: (payload: DeleteMeterWithConfirmInput) =>
      metersApi.deleteWithConfirm(id!, payload),
    onSuccess: async () => {
      messageApi.success(t('meters.detail.meterDeleted'))
      setDeleteModalOpen(false)
      setDeletePassword('')
      navigate('/meters')
      await queryClient.invalidateQueries({ queryKey: ['meters', 'list'] })
      await queryClient.refetchQueries({ queryKey: ['meters', 'list'] })
      await queryClient.invalidateQueries({ queryKey: ['meters'] })
      await queryClient.invalidateQueries({ queryKey: ['meters', 'detail', id] })
    },
    onError: (err: unknown) => {
      messageApi.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          t('meters.detail.deleteFailed'),
      )
    },
  })

  const handleDownloadRecordPdf = async (recordId: string, recordNumber?: string) => {
    try {
      const blob = await installationRecordsApi.getPdfBlob(recordId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `zapisnik-${recordNumber ?? recordId}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      messageApi.success(t('installationRecords.detail.pdfDownloaded'))
    } catch {
      messageApi.error(t('installationRecords.detail.pdfDownloadFailed'))
    }
  }

  const handleDownloadPhoto = async (photoPath: string) => {
    try {
      const blob = await installationRecordsApi.getPhotoBlob(photoPath)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = photoPath.split('/').filter(Boolean).pop() ?? 'photo'
      a.click()
      URL.revokeObjectURL(url)
      messageApi.success(t('meters.detail.photoDownloaded'))
    } catch {
      messageApi.error(t('meters.detail.photoDownloadFailed'))
    }
  }

  const meterTypeFieldsQuery = useQuery({
    queryKey: ['meter-type-definitions', 'fields', meter?.meterTypeDefinitionId],
    queryFn: () => meterTypeDefinitionsApi.listFields(meter!.meterTypeDefinitionId),
    enabled: Boolean(meter?.meterTypeDefinitionId) && editDrawerOpen,
  })

  const meterTypeFieldsDisplayQuery = useQuery({
    queryKey: ['meter-type-definitions', 'fields', meter?.meterTypeDefinitionId, 'display'],
    queryFn: () => meterTypeDefinitionsApi.listFields(meter!.meterTypeDefinitionId),
    enabled: Boolean(meter?.meterTypeDefinitionId),
  })

  const meterTypesQuery = useQuery({
    queryKey: ['meter-type-definitions', 'list-all'],
    queryFn: () => meterTypeDefinitionsApi.listAll(),
    enabled: editDrawerOpen,
  })

  const operatorsQuery = useQuery({
    queryKey: ['users', 'operators', 'v1'],
    queryFn: () => usersApi.list({ page: 1, limit: 100, role: 'USER' }),
    enabled: installDrawerOpen || demountDrawerOpen || reassignDrawerOpen,
  })

  const operatorOptions =
    operatorsQuery.data?.items
      ?.filter((u) => u.role === 'USER')
      .filter((u) => {
        if (!meter?.branchId) return true
        // Moderator can assign only to operators in same branch as meter; admins keep full list.
        if (userRole === 'USER') return u.branchId === meter.branchId
        return true
      })
      .map((u) => ({
        label: `${u.firstName} ${u.lastName} (${u.email})`,
        value: u.id,
      })) ?? []

  const updateMeterMutation = useMutation({
    mutationFn: ({ payload }: { payload: UpdateMeterInput }) => metersApi.update(id!, payload),
    onSuccess: async () => {
      messageApi.success(t('meters.updated'))
      setEditDrawerOpen(false)
      await queryClient.invalidateQueries({ queryKey: ['meters'] })
      await queryClient.invalidateQueries({ queryKey: ['meters', 'detail', id] })
    },
    onError: (err: unknown) => {
      messageApi.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          t('meters.updateFailed'),
      )
    },
  })

  const createInstallMutation = useMutation({
    mutationFn: (payload: { meterId: string; assignedToId: string; notes?: string }) =>
      installTasksApi.create(payload),
    onSuccess: () => {
      messageApi.success(t('meters.install.taskCreated'))
      setInstallDrawerOpen(false)
      setInstallOperatorId('')
      setInstallNotes('')
    },
    onError: (err: unknown) => {
      messageApi.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          t('meters.taskCreateFailed'),
      )
    },
  })

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
      messageApi.success(t('meters.demount.taskCreated'))
      setDemountDrawerOpen(false)
      setDemountOperatorId('')
      setDemountNotes('')
      setDemountResolution('')
      setDemountReason('')
      setDemountRemovedSimDisposition('')
      setDemountMeterDemountCategory('')
      void queryClient.invalidateQueries({ queryKey: ['meters', 'detail', id] })
    },
    onError: (err: unknown) => {
      messageApi.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          t('meters.taskCreateFailed'),
      )
    },
  })

  const cancelInstallTaskMutation = useMutation({
    mutationFn: (taskId: string) => installTasksApi.cancel(taskId),
    onSuccess: async () => {
      messageApi.success(t('meters.detail.installOrderCanceled'))
      await queryClient.invalidateQueries({ queryKey: ['meters', 'detail', id] })
      await queryClient.invalidateQueries({ queryKey: ['meters'] })
    },
    onError: (err: unknown) => {
      messageApi.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          t('meters.detail.cancelOrderFailed'),
      )
    },
  })

  const cancelDemountTaskMutation = useMutation({
    mutationFn: (taskId: string) => demountTasksApi.cancel(taskId),
    onSuccess: async () => {
      messageApi.success(t('meters.detail.demountOrderCanceled'))
      await queryClient.invalidateQueries({ queryKey: ['meters', 'detail', id] })
      await queryClient.invalidateQueries({ queryKey: ['meters'] })
    },
    onError: (err: unknown) => {
      messageApi.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          t('meters.detail.cancelOrderFailed'),
      )
    },
  })

  const reassignInstallTaskMutation = useMutation({
    mutationFn: (payload: { taskId: string; assignedToId: string }) =>
      installTasksApi.reassign(payload.taskId, payload.assignedToId),
    onSuccess: async () => {
      messageApi.success(t('meters.detail.installOrderReassigned'))
      setReassignDrawerOpen(false)
      setReassignTask(null)
      setReassignOperatorId('')
      await queryClient.invalidateQueries({ queryKey: ['meters', 'detail', id] })
      await queryClient.invalidateQueries({ queryKey: ['meters'] })
    },
    onError: (err: unknown) => {
      messageApi.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          t('meters.detail.reassignFailed'),
      )
    },
  })

  const reassignDemountTaskMutation = useMutation({
    mutationFn: (payload: { taskId: string; assignedToId: string }) =>
      demountTasksApi.reassign(payload.taskId, payload.assignedToId),
    onSuccess: async () => {
      messageApi.success(t('meters.detail.demountOrderReassigned'))
      setReassignDrawerOpen(false)
      setReassignTask(null)
      setReassignOperatorId('')
      await queryClient.invalidateQueries({ queryKey: ['meters', 'detail', id] })
      await queryClient.invalidateQueries({ queryKey: ['meters'] })
    },
    onError: (err: unknown) => {
      messageApi.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          t('meters.detail.reassignFailed'),
      )
    },
  })

  const handleOpenEdit = () => {
    if (!meter) return
    meterForm.setFieldsValue({
      serialNumber: meter.serialNumber,
      meterTypeDefinitionId: meter.meterTypeDefinitionId,
      status: meter.status ?? 'ACTIVE',
      year: meter.year ?? undefined,
      calibrationYear: meter.calibrationYear ?? undefined,
      notes: meter.notes ?? undefined,
      installationAddress: meter.installationAddress ?? undefined,
      installationDate: meter.installationDate ? String(meter.installationDate).slice(0, 10) : undefined,
      city: meter.city ?? undefined,
      municipality: meter.municipality ?? undefined,
      measuringPoint: meter.measuringPoint ?? undefined,
      dynamicFieldValues: (meter.dynamicFieldValues ?? undefined) as any,
    })
    setEditDrawerOpen(true)
  }

  const handleMeterSubmit = (values: MeterFormValues) => {
    const payload: UpdateMeterInput = {
      serialNumber: values.serialNumber,
      meterTypeDefinitionId: values.meterTypeDefinitionId,
      status: values.status as any,
      year: values.year,
      calibrationYear: values.calibrationYear,
      notes: values.notes,
      installationAddress: values.installationAddress,
      installationDate: values.installationDate,
      city: values.city,
      municipality: values.municipality,
      measuringPoint: values.measuringPoint,
      dynamicFieldValues: values.dynamicFieldValues as any,
    }
    updateMeterMutation.mutate({ payload })
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

  return (
    <div className="space-y-4">
      {messageContextHolder}
      <Space>
        <Button onClick={() => navigate('/meters')}>{t('common.actions.back')}</Button>
        <Typography.Title level={3} className="!mb-0">
          {t('meters.detail.title')}
        </Typography.Title>
      </Space>

      <Card
        loading={meterQuery.isLoading}
        title={meter ? t('meters.detail.meterColonTitle', { serial: meter.serialNumber }) : t('meters.detail.meterFallbackTitle')}
        extra={
          meter ? (
            <Space>
              {openDemountLabel ? (
                <Tag color="gold">
                  {t('meters.detail.demountOrderCreated')} {openDemountLabel.date} • {openDemountLabel.operator} •{' '}
                  {openDemountLabel.resolution}
                </Tag>
              ) : null}
              {openDemountTask &&
              (openDemountTask.status === 'PENDING' || openDemountTask.status === 'IN_PROGRESS') ? (
                <Space size={4}>
                  <Button
                    onClick={() => {
                      setReassignTask({ kind: 'DEMOUNT', taskId: openDemountTask.id })
                      setReassignDrawerOpen(true)
                    }}
                  >
                    {t('meters.detail.reassign')}
                  </Button>
                  <Popconfirm
                    title={t('meters.detail.confirmCancelDemount')}
                    okText={t('common.actions.yes')}
                    cancelText={t('common.actions.no')}
                    okButtonProps={{ danger: true }}
                    onConfirm={() => cancelDemountTaskMutation.mutate(openDemountTask.id)}
                  >
                    <Button danger loading={cancelDemountTaskMutation.isPending}>
                      {t('meters.detail.cancelButton')}
                    </Button>
                  </Popconfirm>
                </Space>
              ) : null}
              {meter.simCard && !openDemountLabel ? (
                <Button
                  disabled={!isActiveMeter || !canCreateDemountTask}
                  title={
                    !canCreateDemountTask
                      ? t('meters.detail.noPermissionDemount')
                      : !isActiveMeter
                        ? t('meters.detail.meterMustBeActive')
                        : undefined
                  }
                  onClick={() => {
                    if (!canCreateDemountTask) {
                      messageApi.error(t('meters.detail.noPermissionDemount'))
                      return
                    }
                    setDemountDrawerOpen(true)
                  }}
                >
                  {t('meters.demount.buttonLabel')}
                </Button>
              ) : null}
              {meter.simCardState === 'NO_SIM' || !meter.simCard ? (
                openInstallTask ? (
                  <Tag color={openInstallTask.status === 'IN_PROGRESS' ? 'gold' : 'blue'}>
                    {t('meters.detail.installOrderCreated')} {openInstallLabel?.date} • {openInstallLabel?.operator} (
                    {openInstallLabel?.status})
                  </Tag>
                ) : (
                  <Button
                    disabled={!isActiveMeter || !canCreateInstallTask}
                    title={
                      !canCreateInstallTask
                        ? t('meters.detail.noPermissionInstall')
                        : !isActiveMeter
                          ? t('meters.detail.meterMustBeActive')
                          : undefined
                    }
                    onClick={() => {
                      if (!canCreateInstallTask) {
                        messageApi.error(t('meters.detail.noPermissionInstall'))
                        return
                      }
                      setInstallDrawerOpen(true)
                    }}
                  >
                    {t('meters.detail.sendToInstall')}
                  </Button>
                )
              ) : null}
              {openInstallTask &&
              (openInstallTask.status === 'PENDING' || openInstallTask.status === 'IN_PROGRESS') ? (
                <Space size={4}>
                  <Button
                    onClick={() => {
                      setReassignTask({ kind: 'INSTALL', taskId: openInstallTask.id })
                      setReassignDrawerOpen(true)
                    }}
                  >
                    {t('meters.detail.reassign')}
                  </Button>
                  <Popconfirm
                    title={t('meters.detail.confirmCancelInstall')}
                    okText={t('common.actions.yes')}
                    cancelText={t('common.actions.no')}
                    okButtonProps={{ danger: true }}
                    onConfirm={() => cancelInstallTaskMutation.mutate(openInstallTask.id)}
                  >
                    <Button danger loading={cancelInstallTaskMutation.isPending}>
                      {t('meters.detail.cancelButton')}
                    </Button>
                  </Popconfirm>
                </Space>
              ) : null}
              <Button type="primary" onClick={handleOpenEdit}>
                {t('common.actions.edit')}
              </Button>
              {userRole === 'SYSTEM_ADMIN' ? (
                <Button
                  danger
                  onClick={() => {
                    setDeleteModalOpen(true)
                    setDeletePassword('')
                    setDeleteRecordsAction('ABORT_IF_EXISTS')
                    setDeleteSimAction(meter.simCard ? 'RETURN_SIM_TO_AVAILABLE' : 'LEAVE_AS_IS')
                  }}
                >
                  {t('meters.detail.deleteMeterButton')}
                </Button>
              ) : null}
            </Space>
          ) : null
        }
      >
        {meter ? (
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label={t('installationRecords.form.meterSerialLabel')}>{meter.serialNumber}</Descriptions.Item>
            <Descriptions.Item label={t('meters.columns.meterStatus')}>
              {meter.status ? (
                <Tag color={meter.status === 'ACTIVE' ? 'success' : meter.status === 'DEFECTIVE' ? 'error' : 'warning'}>
                  {meterStatusLabel(meter.status, t)}
                </Tag>
              ) : (
                '–'
              )}
            </Descriptions.Item>
            <Descriptions.Item label={t('installationRecords.form.meterTypeLabel')}>{meter.meterTypeDefinition?.name ?? '–'}</Descriptions.Item>
            <Descriptions.Item label={t('meterTypes.manufacturer')}>{meter.meterTypeDefinition?.manufacturer ?? '–'}</Descriptions.Item>
            <Descriptions.Item label={t('meterTypes.model')}>{meter.meterTypeDefinition?.model ?? '–'}</Descriptions.Item>
            <Descriptions.Item label={t('meterTypes.phaseColumn')}>
              {meter.meterTypeDefinition?.type ? renderType(meter.meterTypeDefinition.type, t) : '–'}
            </Descriptions.Item>
            <Descriptions.Item label={t('meterTypes.maxCurrent')}>{meter.meterTypeDefinition?.maxCurrent ?? '–'}</Descriptions.Item>
            <Descriptions.Item label={t('installationRecords.form.yearLabel')}>{meter.year != null ? String(meter.year) : '–'}</Descriptions.Item>
            <Descriptions.Item label={t('installationRecords.form.calibrationYearLabel')}>
              {meter.calibrationYear != null ? String(meter.calibrationYear) : '–'}
            </Descriptions.Item>
            <Descriptions.Item label={t('installationRecords.detail.installationLocationLabel')}>{meter.installationAddress ?? '–'}</Descriptions.Item>
            <Descriptions.Item label={t('installationRecords.list.columns.installationDate')}>
              {meter.installationDate ? String(meter.installationDate).slice(0, 10) : '–'}
            </Descriptions.Item>
            <Descriptions.Item label={t('installationRecords.form.measuringPointLabel')}>{meter.measuringPoint ?? '–'}</Descriptions.Item>
            <Descriptions.Item label={t('common.labels.notes')}>{meter.notes ?? '–'}</Descriptions.Item>
            <Descriptions.Item label={t('installationRecords.detail.simStatusLabel')}>
              {meter.simCardState === 'NO_SIM' || !meter.simCard ? (
                <Tag color="warning">{t('meters.noSimOption')}</Tag>
              ) : (
                <Tag color="success">{t('meters.simInstalledOption')}</Tag>
              )}
              {meter.simCardState === 'NO_SIM' && meter.noSimReason ? (
                <Typography.Text type="secondary" className="ml-2 text-xs">
                  ({meter.noSimReason})
                </Typography.Text>
              ) : null}
            </Descriptions.Item>
            {meter.simCard ? (
              <>
                <Descriptions.Item label={t('meters.installedSimCardLabel')}>
                  <Link to={`/sim-cards/${meter.simCard.id}`}>{meter.simCard.iccid}</Link>
                </Descriptions.Item>
                <Descriptions.Item label={t('simCards.details.ipAddress')}>{meter.simCard.ipAddress ?? '–'}</Descriptions.Item>
              </>
            ) : null}

            {meter.dynamicFieldValues &&
            Object.keys(meter.dynamicFieldValues).length > 0 &&
            (meterTypeFieldsDisplayQuery.data ?? []).some((f) => {
              const vals = meter.dynamicFieldValues as Record<string, unknown>
              const v = vals[f.name]
              return v !== undefined && v !== null && v !== ''
            }) ? (
              <>
                {(meterTypeFieldsDisplayQuery.data ?? [])
                  .slice()
                  .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                  .map((field) => {
                    const vals = (meter.dynamicFieldValues ?? {}) as Record<string, unknown>
                    const display = formatDynamicFieldValue(field, vals[field.name])
                    if (!display) return null
                    return (
                      <Descriptions.Item key={field.id} label={field.label}>
                        {display}
                      </Descriptions.Item>
                    )
                  })}
              </>
            ) : null}
          </Descriptions>
        ) : null}
      </Card>

      {meter?.latitude != null && meter?.longitude != null ? (
        <Card title={t('installationRecords.detail.mapCardTitle')}>
          <iframe
            title={t('meters.detail.meterLocationTitle')}
            src={buildOsmEmbedUrl({
              latitude: Number(meter.latitude),
              longitude: Number(meter.longitude),
              radiusMeters: 50,
            })}
            width="100%"
            height="280"
            style={{ border: 0, borderRadius: 8 }}
            loading="lazy"
          />
        </Card>
      ) : null}

      <Card title={t('meters.detail.recordsForMeterTitle')} loading={recordsQuery.isLoading}>
        {recordsQuery.data?.items?.length ? (
          <ul className="list-disc pl-4 space-y-1">
            {recordsQuery.data.items.map((r) => (
              <li key={r.id}>
                <Link to={`/installation-records/${r.id}`}>{r.recordNumber}</Link>
              </li>
            ))}
          </ul>
        ) : (
          <Typography.Text type="secondary">{t('meters.detail.noRecords')}</Typography.Text>
        )}
      </Card>

      <Card title={t('installationRecords.detail.timelineCardTitle')}>
        <Typography.Text type="secondary">
          {t('meters.detail.timelinePlaceholder')}
        </Typography.Text>
      </Card>

      <Drawer
        title={t('meters.detail.reassignOrderTitle')}
        open={reassignDrawerOpen}
        width={520}
        onClose={() => {
          setReassignDrawerOpen(false)
          setReassignTask(null)
          setReassignOperatorId('')
        }}
        destroyOnClose
        footer={
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                setReassignDrawerOpen(false)
                setReassignTask(null)
                setReassignOperatorId('')
              }}
            >
              {t('common.actions.cancel')}
            </Button>
            <Button
              type="primary"
              disabled={!reassignTask || !reassignOperatorId}
              loading={reassignInstallTaskMutation.isPending || reassignDemountTaskMutation.isPending}
              onClick={() => {
                if (!reassignTask || !reassignOperatorId) return
                if (reassignTask.kind === 'INSTALL') {
                  reassignInstallTaskMutation.mutate({
                    taskId: reassignTask.taskId,
                    assignedToId: reassignOperatorId,
                  })
                  return
                }
                reassignDemountTaskMutation.mutate({
                  taskId: reassignTask.taskId,
                  assignedToId: reassignOperatorId,
                })
              }}
            >
              {t('meters.detail.reassign')}
            </Button>
          </div>
        }
      >
        <Space direction="vertical" className="w-full" size="middle">
          <Typography.Text type="secondary">
            {t('meters.detail.reassignHint')}
          </Typography.Text>
          <Form.Item label={t('meters.detail.operatorLabel')} required>
            <Select
              placeholder={t('meters.selectOperatorPlaceholder')}
              value={reassignOperatorId || undefined}
              onChange={setReassignOperatorId}
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
        </Space>
      </Drawer>

      <Drawer
        title={t('meters.install.drawerTitle')}
        open={installDrawerOpen}
        width={520}
        onClose={() => {
          setInstallDrawerOpen(false)
          setInstallOperatorId('')
          setInstallNotes('')
        }}
        destroyOnClose
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => setInstallDrawerOpen(false)}>{t('common.actions.cancel')}</Button>
            <Button
              type="primary"
              loading={createInstallMutation.isPending}
              onClick={() => {
                if (!id || !installOperatorId) return
                if (!canCreateInstallTask) {
                  messageApi.error(t('meters.detail.noPermissionInstall'))
                  return
                }
                createInstallMutation.mutate({
                  meterId: id,
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
        <Space direction="vertical" className="w-full" size="middle">
          <Form.Item label={t('meters.detail.operatorLabel')} required>
            <Select
              placeholder={t('meters.selectOperatorPlaceholder')}
              value={installOperatorId || undefined}
              onChange={setInstallOperatorId}
              options={operatorOptions}
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
      </Drawer>

      <Drawer
        title={t('meters.demount.drawerTitle')}
        open={demountDrawerOpen}
        width={520}
        onClose={() => {
          setDemountDrawerOpen(false)
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
            <Button onClick={() => setDemountDrawerOpen(false)}>{t('common.actions.cancel')}</Button>
            <Button
              type="primary"
              loading={createDemountMutation.isPending}
              onClick={() => {
                if (!id || !demountOperatorId) return
                if (!canCreateDemountTask) {
                  messageApi.error(t('meters.detail.noPermissionDemount'))
                  return
                }
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
                  meterId: id,
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
        <Space direction="vertical" className="w-full" size="middle">
          <Form.Item label={t('meters.detail.operatorLabel')} required>
            <Select
              placeholder={t('meters.selectOperatorPlaceholder')}
              value={demountOperatorId || undefined}
              onChange={setDemountOperatorId}
              options={operatorOptions.map((o) => ({ ...o, label: String(o.label).replace(/\s*\(.*\)\s*$/, '') }))}
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
              options={(['MARK_DEFECTIVE', 'RETURN_TO_STOCK'] as RemovedSimDisposition[]).map((v) => ({
                label: getRemovedSimDispositionLabel(v, t),
                value: v,
              }))}
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
      </Drawer>

      <Drawer
        title={t('meters.editMeter')}
        open={editDrawerOpen}
        width={560}
        onClose={() => setEditDrawerOpen(false)}
        destroyOnClose
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => setEditDrawerOpen(false)}>{t('common.actions.cancel')}</Button>
            <Button type="primary" loading={updateMeterMutation.isPending} onClick={() => meterForm.submit()}>
              {t('common.actions.save')}
            </Button>
          </div>
        }
      >
        <Form form={meterForm} layout="vertical" onFinish={handleMeterSubmit} className="mt-4">
          <Form.Item name="serialNumber" label={t('installationRecords.form.meterSerialLabel')} rules={[{ required: true, message: t('installationRecords.form.serialNumberRequired') }]}>
            <Input placeholder="npr. AMM-12345" />
          </Form.Item>
          <Form.Item
            name="meterTypeDefinitionId"
            label={t('meters.meterTypeCatalogLabel')}
            rules={[{ required: true, message: t('installationRecords.form.meterTypeRequired') }]}
          >
            <Select
              placeholder={t('meters.selectFromCatalogPlaceholder')}
              options={meterTypesQuery.data?.map((mtd) => ({ label: mtd.name, value: mtd.id })) ?? []}
              loading={meterTypesQuery.isLoading}
            />
          </Form.Item>
          <Form.Item name="status" label={t('meters.columns.meterStatus')}>
            <Select
              options={[
                { label: t('labels.meterStatus.active'), value: 'ACTIVE' },
                { label: t('labels.meterStatus.defective'), value: 'DEFECTIVE' },
                { label: t('labels.meterStatus.inCalibration'), value: 'IN_CALIBRATION' },
                { label: t('labels.meterStatus.inactive'), value: 'INACTIVE' },
              ]}
            />
          </Form.Item>
          <Form.Item name="year" label={t('installationRecords.form.yearLabel')} rules={[{ required: true, message: t('installationRecords.form.requiredShort') }]}>
            <InputNumber min={1970} max={2100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="calibrationYear" label={t('installationRecords.form.calibrationYearLabel')} rules={[{ required: true, message: t('installationRecords.form.requiredShort') }]}>
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

          {meter?.meterTypeDefinitionId ? (
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
              {meterTypeFieldsQuery.isLoading ? (
                <div className="text-sm text-slate-500">{t('installationRecords.form.loadingFields')}</div>
              ) : null}
            </div>
          ) : null}
        </Form>
      </Drawer>

      <Modal
        title={t('meters.detail.deleteModalTitle')}
        open={deleteModalOpen}
        okText={t('common.actions.delete')}
        cancelText={t('common.actions.cancel')}
        okButtonProps={{
          danger: true,
          loading: deleteWithConfirmMutation.isPending,
          disabled: !deletePassword.trim() ||
            (deleteSummaryQuery.data?.installationRecords?.count ?? 0) > 0 &&
              deleteRecordsAction !== 'DELETE_ALL',
        }}
        onCancel={() => {
          setDeleteModalOpen(false)
          setDeletePassword('')
        }}
        onOk={() => {
          if (!id) return
          deleteWithConfirmMutation.mutate({
            password: deletePassword,
            simAction: deleteSimAction,
            recordsAction: deleteRecordsAction,
          })
        }}
        destroyOnClose
      >
        {deleteSummaryQuery.isLoading ? (
          <Typography.Text type="secondary">{t('meters.detail.loadingLinks')}</Typography.Text>
        ) : deleteSummaryQuery.data ? (
          <div className="space-y-3">
            <Typography.Text>
              {t('meters.detail.deleteWarningIntro')}
            </Typography.Text>

            <Card size="small" title={t('meters.detail.linksCardTitle')}>
              <div className="space-y-2">
                {deleteSummaryQuery.data.meter.hasOpenInstallTask ||
                deleteSummaryQuery.data.meter.hasOpenDemountTask ? (
                  <Typography.Text type="warning">
                    {t('meters.detail.openOrderWarning')} (
                    {deleteSummaryQuery.data.meter.hasOpenInstallTask ? t('meters.detail.installWord') : null}
                    {deleteSummaryQuery.data.meter.hasOpenInstallTask &&
                    deleteSummaryQuery.data.meter.hasOpenDemountTask
                      ? ' + '
                      : null}
                    {deleteSummaryQuery.data.meter.hasOpenDemountTask ? t('meters.detail.demountWord') : null}
                    ). {t('meters.detail.closeOrdersRecommendation')}
                  </Typography.Text>
                ) : null}

                <div>
                  <Typography.Text strong>SIM</Typography.Text>
                  <div className="mt-1">
                    {deleteSummaryQuery.data.simCard ? (
                      <div className="space-y-2">
                        <Typography.Text>
                          {t('meters.detail.installedSimColon')} {deleteSummaryQuery.data.simCard.iccid} •{' '}
                          {deleteSummaryQuery.data.simCard.status}
                        </Typography.Text>
                        <Radio.Group
                          value={deleteSimAction}
                          onChange={(e) => setDeleteSimAction(e.target.value)}
                        >
                          <Space direction="vertical">
                            <Radio value="RETURN_SIM_TO_AVAILABLE">{t('meters.detail.returnSimToAvailable')}</Radio>
                            <Radio value="DELETE_SIM">{t('meters.detail.deleteSimFromDb')}</Radio>
                            <Radio value="LEAVE_AS_IS">{t('meters.detail.leaveSimAsIs')}</Radio>
                          </Space>
                        </Radio.Group>
                      </div>
                    ) : (
                      <Typography.Text type="secondary">{t('meters.detail.noInstalledSim')}</Typography.Text>
                    )}
                  </div>
                </div>

                <div>
                  <Typography.Text strong>{t('installationRecords.list.title')}</Typography.Text>
                  <div className="mt-1 space-y-2">
                    <Typography.Text>
                      {t('common.labels.total')}: {deleteSummaryQuery.data.installationRecords.count}
                    </Typography.Text>
                    {deleteSummaryQuery.data.installationRecords.items.length ? (
                      <ul className="list-disc pl-4 space-y-1">
                        {deleteSummaryQuery.data.installationRecords.items.map((r) => (
                          <li key={r.id}>
                            <Space wrap>
                              <Link to={`/installation-records/${r.id}`}>{r.recordNumber}</Link>
                              <Button size="small" onClick={() => handleDownloadRecordPdf(r.id, r.recordNumber)}>
                                PDF
                              </Button>
                              {(r.photos ?? []).length > 0 ? (
                                <Space size={4} wrap>
                                  {(r.photos ?? []).slice(0, 5).map((p, idx) => (
                                    <Button
                                      key={`${r.id}-${idx}`}
                                      size="small"
                                      onClick={() => handleDownloadPhoto(String(p))}
                                    >
                                      {t('meters.detail.photoLabel')} {idx + 1}
                                    </Button>
                                  ))}
                                  {(r.photos ?? []).length > 5 ? (
                                    <Typography.Text type="secondary">
                                      +{(r.photos ?? []).length - 5} {t('meters.detail.photoLabel').toLowerCase()}
                                    </Typography.Text>
                                  ) : null}
                                </Space>
                              ) : (
                                <Typography.Text type="secondary">{t('meters.detail.noPhotos')}</Typography.Text>
                              )}
                            </Space>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <Typography.Text type="secondary">{t('meters.detail.noRecords')}</Typography.Text>
                    )}

                    <Radio.Group
                      value={deleteRecordsAction}
                      onChange={(e) => setDeleteRecordsAction(e.target.value)}
                    >
                      <Space direction="vertical">
                        <Radio value="ABORT_IF_EXISTS">
                          {t('meters.detail.dontDeleteRecords')}
                        </Radio>
                        <Radio value="DELETE_ALL">{t('meters.detail.deleteAllRecords')}</Radio>
                      </Space>
                    </Radio.Group>

                    {(deleteSummaryQuery.data.installationRecords.count ?? 0) > 0 &&
                    deleteRecordsAction !== 'DELETE_ALL' ? (
                      <Typography.Text type="warning">
                        {t('meters.detail.deleteAllRecordsWarning')}
                      </Typography.Text>
                    ) : null}
                  </div>
                </div>

                <div>
                  <Typography.Text strong>{t('meters.detail.otherLinks')}</Typography.Text>
                  <div className="mt-1">
                    <ul className="list-disc pl-4 space-y-1">
                      <li>
                        {t('meters.detail.installTasksLabel')} {deleteSummaryQuery.data.tasks.installTasksCount} (open:{' '}
                        {deleteSummaryQuery.data.meter.hasOpenInstallTask ? t('common.actions.yes') : t('common.actions.no')})
                      </li>
                      <li>
                        {t('meters.detail.demountTasksLabel')} {deleteSummaryQuery.data.tasks.demountTasksCount} (open:{' '}
                        {deleteSummaryQuery.data.meter.hasOpenDemountTask ? t('common.actions.yes') : t('common.actions.no')})
                      </li>
                      <li>Branch ID: {deleteSummaryQuery.data.meter.branchId ?? '–'}</li>
                      <li>{t('meters.detail.meterTypeIdLabel')} {deleteSummaryQuery.data.meter.meterTypeDefinitionId}</li>
                    </ul>
                  </div>
                </div>
              </div>
            </Card>

            <Card size="small" title={t('meters.detail.passwordConfirmTitle')}>
              <Input.Password
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder={t('meters.detail.enterPasswordPlaceholder')}
              />
              <Typography.Text type="secondary" className="block mt-2">
                {t('meters.detail.passwordConfirmHint')}
              </Typography.Text>
            </Card>
          </div>
        ) : (
          <Typography.Text type="danger">{t('meters.detail.cannotLoadDeleteData')}</Typography.Text>
        )}
      </Modal>
    </div>
  )
}
