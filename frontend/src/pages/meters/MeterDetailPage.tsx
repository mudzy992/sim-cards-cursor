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

const renderType = (t: MeterType) =>
  t === 'SINGLE_PHASE' ? 'Jednofazno' : t === 'THREE_PHASE' ? 'Trofazno' : t

const meterStatusLabel = (s: MeterStatus) => {
  if (s === 'ACTIVE') return 'Aktivno'
  if (s === 'DEFECTIVE') return 'Neispravno'
  if (s === 'INACTIVE') return 'Neaktivno'
  return 'Na baždarenju / servis'
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
        date: new Date(openInstallTask.createdAt).toLocaleString('bs-BA'),
        operator: openInstallTask.assignedTo
          ? `${openInstallTask.assignedTo.firstName} ${openInstallTask.assignedTo.lastName}`
          : '–',
        status:
          openInstallTask.status === 'IN_PROGRESS'
            ? 'U toku'
            : openInstallTask.status === 'PENDING'
              ? 'Čeka'
              : openInstallTask.status,
      }
    : null

  const openDemountLabel = openDemountTask
    ? {
        date: new Date(openDemountTask.createdAt).toLocaleString('bs-BA'),
        operator: openDemountTask.assignedTo
          ? `${openDemountTask.assignedTo.firstName} ${openDemountTask.assignedTo.lastName}`
          : '–',
        resolution: openDemountTask.requestedResolution
          ? getDemountResolutionLabel(openDemountTask.requestedResolution)
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
      messageApi.success('Brojilo je obrisano.')
      setDeleteModalOpen(false)
      setDeletePassword('')
      await queryClient.invalidateQueries({ queryKey: ['meters'] })
      await queryClient.invalidateQueries({ queryKey: ['meters', 'detail', id] })
      navigate('/meters')
    },
    onError: (err: unknown) => {
      messageApi.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Brisanje brojila nije uspjelo.',
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
      messageApi.success('PDF je preuzet.')
    } catch {
      messageApi.error('Preuzimanje PDF-a nije uspjelo.')
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
      messageApi.success('Fotografija je preuzeta.')
    } catch {
      messageApi.error('Preuzimanje fotografije nije uspjelo.')
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
      messageApi.success('Brojilo je ažurirano.')
      setEditDrawerOpen(false)
      await queryClient.invalidateQueries({ queryKey: ['meters'] })
      await queryClient.invalidateQueries({ queryKey: ['meters', 'detail', id] })
    },
    onError: (err: unknown) => {
      messageApi.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Ažuriranje brojila nije uspjelo.',
      )
    },
  })

  const createInstallMutation = useMutation({
    mutationFn: (payload: { meterId: string; assignedToId: string; notes?: string }) =>
      installTasksApi.create(payload),
    onSuccess: () => {
      messageApi.success('Zadatak ugradnje SIM-a je kreiran.')
      setInstallDrawerOpen(false)
      setInstallOperatorId('')
      setInstallNotes('')
    },
    onError: (err: unknown) => {
      messageApi.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Kreiranje zadatka nije uspjelo.',
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
      messageApi.success('Zadatak demontaže SIM-a je kreiran.')
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
          'Kreiranje zadatka nije uspjelo.',
      )
    },
  })

  const cancelInstallTaskMutation = useMutation({
    mutationFn: (taskId: string) => installTasksApi.cancel(taskId),
    onSuccess: async () => {
      messageApi.success('Nalog ugradnje je otkazan.')
      await queryClient.invalidateQueries({ queryKey: ['meters', 'detail', id] })
      await queryClient.invalidateQueries({ queryKey: ['meters'] })
    },
    onError: (err: unknown) => {
      messageApi.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Otkazivanje naloga nije uspjelo.',
      )
    },
  })

  const cancelDemountTaskMutation = useMutation({
    mutationFn: (taskId: string) => demountTasksApi.cancel(taskId),
    onSuccess: async () => {
      messageApi.success('Nalog demontaže je otkazan.')
      await queryClient.invalidateQueries({ queryKey: ['meters', 'detail', id] })
      await queryClient.invalidateQueries({ queryKey: ['meters'] })
    },
    onError: (err: unknown) => {
      messageApi.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Otkazivanje naloga nije uspjelo.',
      )
    },
  })

  const reassignInstallTaskMutation = useMutation({
    mutationFn: (payload: { taskId: string; assignedToId: string }) =>
      installTasksApi.reassign(payload.taskId, payload.assignedToId),
    onSuccess: async () => {
      messageApi.success('Nalog ugradnje je pre-dodijeljen.')
      setReassignDrawerOpen(false)
      setReassignTask(null)
      setReassignOperatorId('')
      await queryClient.invalidateQueries({ queryKey: ['meters', 'detail', id] })
      await queryClient.invalidateQueries({ queryKey: ['meters'] })
    },
    onError: (err: unknown) => {
      messageApi.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Pre-dodjela naloga nije uspjela.',
      )
    },
  })

  const reassignDemountTaskMutation = useMutation({
    mutationFn: (payload: { taskId: string; assignedToId: string }) =>
      demountTasksApi.reassign(payload.taskId, payload.assignedToId),
    onSuccess: async () => {
      messageApi.success('Nalog demontaže je pre-dodijeljen.')
      setReassignDrawerOpen(false)
      setReassignTask(null)
      setReassignOperatorId('')
      await queryClient.invalidateQueries({ queryKey: ['meters', 'detail', id] })
      await queryClient.invalidateQueries({ queryKey: ['meters'] })
    },
    onError: (err: unknown) => {
      messageApi.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Pre-dodjela naloga nije uspjela.',
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
      return raw === true || raw === 'true' ? 'Da' : 'Ne'
    }
    if (field.fieldType === 'DATE') {
      const d = new Date(String(raw))
      return Number.isNaN(d.getTime()) ? String(raw) : d.toLocaleDateString('bs-BA')
    }
    return String(raw)
  }

  return (
    <div className="space-y-4">
      {messageContextHolder}
      <Space>
        <Button onClick={() => navigate('/meters')}>Nazad</Button>
        <Typography.Title level={3} className="!mb-0">
          Detalji brojila
        </Typography.Title>
      </Space>

      <Card
        loading={meterQuery.isLoading}
        title={meter ? `Brojilo: ${meter.serialNumber}` : 'Brojilo'}
        extra={
          meter ? (
            <Space>
              {openDemountLabel ? (
                <Tag color="gold">
                  Kreiran nalog za demontažu: {openDemountLabel.date} • {openDemountLabel.operator} •{' '}
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
                    Pre-dodijeli
                  </Button>
                  <Popconfirm
                    title="Otkaži nalog demontaže?"
                    okText="Da"
                    cancelText="Ne"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => cancelDemountTaskMutation.mutate(openDemountTask.id)}
                  >
                    <Button danger loading={cancelDemountTaskMutation.isPending}>
                      Otkaži
                    </Button>
                  </Popconfirm>
                </Space>
              ) : null}
              {meter.simCard && !openDemountLabel ? (
                <Button
                  disabled={!isActiveMeter || !canCreateDemountTask}
                  title={
                    !canCreateDemountTask
                      ? 'Nemate pravo kreirati demontažu za ovo brojilo.'
                      : !isActiveMeter
                        ? 'Brojilo mora biti aktivno.'
                        : undefined
                  }
                  onClick={() => {
                    if (!canCreateDemountTask) {
                      messageApi.error('Nemate pravo kreirati demontažu za ovo brojilo.')
                      return
                    }
                    setDemountDrawerOpen(true)
                  }}
                >
                  Demontaža
                </Button>
              ) : null}
              {meter.simCardState === 'NO_SIM' || !meter.simCard ? (
                openInstallTask ? (
                  <Tag color={openInstallTask.status === 'IN_PROGRESS' ? 'gold' : 'blue'}>
                    Kreiran nalog za ugradnju: {openInstallLabel?.date} • {openInstallLabel?.operator} (
                    {openInstallLabel?.status})
                  </Tag>
                ) : (
                  <Button
                    disabled={!isActiveMeter || !canCreateInstallTask}
                    title={
                      !canCreateInstallTask
                        ? 'Nemate pravo kreirati ugradnju za ovo brojilo.'
                        : !isActiveMeter
                          ? 'Brojilo mora biti aktivno.'
                          : undefined
                    }
                    onClick={() => {
                      if (!canCreateInstallTask) {
                        messageApi.error('Nemate pravo kreirati ugradnju za ovo brojilo.')
                        return
                      }
                      setInstallDrawerOpen(true)
                    }}
                  >
                    Pošalji na ugradnju
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
                    Pre-dodijeli
                  </Button>
                  <Popconfirm
                    title="Otkaži nalog ugradnje?"
                    okText="Da"
                    cancelText="Ne"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => cancelInstallTaskMutation.mutate(openInstallTask.id)}
                  >
                    <Button danger loading={cancelInstallTaskMutation.isPending}>
                      Otkaži
                    </Button>
                  </Popconfirm>
                </Space>
              ) : null}
              <Button type="primary" onClick={handleOpenEdit}>
                Uredi
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
                  Obriši brojilo
                </Button>
              ) : null}
            </Space>
          ) : null
        }
      >
        {meter ? (
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Serijski broj">{meter.serialNumber}</Descriptions.Item>
            <Descriptions.Item label="Status brojila">
              {meter.status ? (
                <Tag color={meter.status === 'ACTIVE' ? 'success' : meter.status === 'DEFECTIVE' ? 'error' : 'warning'}>
                  {meterStatusLabel(meter.status)}
                </Tag>
              ) : (
                '–'
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Tip brojila">{meter.meterTypeDefinition?.name ?? '–'}</Descriptions.Item>
            <Descriptions.Item label="Proizvođač">{meter.meterTypeDefinition?.manufacturer ?? '–'}</Descriptions.Item>
            <Descriptions.Item label="Model">{meter.meterTypeDefinition?.model ?? '–'}</Descriptions.Item>
            <Descriptions.Item label="Jednofazno / Trofazno">
              {meter.meterTypeDefinition?.type ? renderType(meter.meterTypeDefinition.type) : '–'}
            </Descriptions.Item>
            <Descriptions.Item label="Maks. struja (A)">{meter.meterTypeDefinition?.maxCurrent ?? '–'}</Descriptions.Item>
            <Descriptions.Item label="Godina proizvodnje">{meter.year != null ? String(meter.year) : '–'}</Descriptions.Item>
            <Descriptions.Item label="Godina baždarenja">
              {meter.calibrationYear != null ? String(meter.calibrationYear) : '–'}
            </Descriptions.Item>
            <Descriptions.Item label="Lokacija instalacije">{meter.installationAddress ?? '–'}</Descriptions.Item>
            <Descriptions.Item label="Datum instalacije">
              {meter.installationDate ? String(meter.installationDate).slice(0, 10) : '–'}
            </Descriptions.Item>
            <Descriptions.Item label="Mjerno mjesto">{meter.measuringPoint ?? '–'}</Descriptions.Item>
            <Descriptions.Item label="Napomena">{meter.notes ?? '–'}</Descriptions.Item>
            <Descriptions.Item label="Status SIM-a">
              {meter.simCardState === 'NO_SIM' || !meter.simCard ? (
                <Tag color="warning">Bez SIM</Tag>
              ) : (
                <Tag color="success">SIM ugrađena</Tag>
              )}
              {meter.simCardState === 'NO_SIM' && meter.noSimReason ? (
                <Typography.Text type="secondary" className="ml-2 text-xs">
                  ({meter.noSimReason})
                </Typography.Text>
              ) : null}
            </Descriptions.Item>
            {meter.simCard ? (
              <>
                <Descriptions.Item label="SIM kartica (ugrađena)">
                  <Link to={`/sim-cards/${meter.simCard.id}`}>{meter.simCard.iccid}</Link>
                </Descriptions.Item>
                <Descriptions.Item label="IP adresa">{meter.simCard.ipAddress ?? '–'}</Descriptions.Item>
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
        <Card title="Lokacija na mapi">
          <iframe
            title="Lokacija brojila"
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

      <Card title="Zapisnici za ovo brojilo" loading={recordsQuery.isLoading}>
        {recordsQuery.data?.items?.length ? (
          <ul className="list-disc pl-4 space-y-1">
            {recordsQuery.data.items.map((r) => (
              <li key={r.id}>
                <Link to={`/installation-records/${r.id}`}>{r.recordNumber}</Link>
              </li>
            ))}
          </ul>
        ) : (
          <Typography.Text type="secondary">Nema zapisnika.</Typography.Text>
        )}
      </Card>

      <Card title="Timeline aktivnosti">
        <Typography.Text type="secondary">
          Timeline za brojilo će biti prikazan kada backend počne logovati aktivnosti sa entity = meter.
        </Typography.Text>
      </Card>

      <Drawer
        title="Pre-dodijeli nalog"
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
              Odustani
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
              Pre-dodijeli
            </Button>
          </div>
        }
      >
        <Space direction="vertical" className="w-full" size="middle">
          <Typography.Text type="secondary">
            Odaberite operatora kojem dodjeljujete ovaj nalog.
          </Typography.Text>
          <Form.Item label="Operator" required>
            <Select
              placeholder="Odaberite operatora"
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
        title="Zadatak ugradnje SIM kartice"
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
            <Button onClick={() => setInstallDrawerOpen(false)}>Odustani</Button>
            <Button
              type="primary"
              loading={createInstallMutation.isPending}
              onClick={() => {
                if (!id || !installOperatorId) return
                if (!canCreateInstallTask) {
                  messageApi.error('Nemate pravo kreirati ugradnju za ovo brojilo.')
                  return
                }
                createInstallMutation.mutate({
                  meterId: id,
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
        <Space direction="vertical" className="w-full" size="middle">
          <Form.Item label="Operator" required>
            <Select
              placeholder="Odaberite operatora"
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
          <Form.Item label="Napomena">
            <Input.TextArea
              rows={2}
              value={installNotes}
              onChange={(e) => setInstallNotes(e.target.value)}
              placeholder="Opcionalno"
            />
          </Form.Item>
        </Space>
      </Drawer>

      <Drawer
        title="Zadatak demontaže SIM kartice"
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
            <Button onClick={() => setDemountDrawerOpen(false)}>Odustani</Button>
            <Button
              type="primary"
              loading={createDemountMutation.isPending}
              onClick={() => {
                if (!id || !demountOperatorId) return
                if (!canCreateDemountTask) {
                  messageApi.error('Nemate pravo kreirati demontažu za ovo brojilo.')
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
              Kreiraj zadatak
            </Button>
          </div>
        }
      >
        <Space direction="vertical" className="w-full" size="middle">
          <Form.Item label="Operator " required>
            <Select
              placeholder="Odaberite operatora"
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
          <Form.Item label="Napomena">
            <Input.TextArea
              rows={2}
              value={demountNotes}
              onChange={(e) => setDemountNotes(e.target.value)}
              placeholder="Opcionalno"
            />
          </Form.Item>

          <Form.Item label="Rezolucija" required>
            <Select
              placeholder="Odaberite rezoluciju"
              value={demountResolution || undefined}
              onChange={(v) => {
                setDemountResolution(v)
                if (v === 'REPLACE_SIM') setDemountMeterDemountCategory('')
              }}
              options={(
                ['FULL_DEMOUNT', 'REPLACE_SIM', 'REMOVE_SIM_ONLY'] as DemountCompletionResolution[]
              ).map((v) => ({
                label: getDemountResolutionLabel(v),
                value: v,
              }))}
            />
          </Form.Item>

          <Form.Item label="Ishod uklonjene SIM" required>
            <Select
              placeholder="Odaberite ishod uklonjene SIM"
              value={demountRemovedSimDisposition || undefined}
              onChange={setDemountRemovedSimDisposition}
              options={(['MARK_DEFECTIVE', 'RETURN_TO_STOCK'] as RemovedSimDisposition[]).map((v) => ({
                label: getRemovedSimDispositionLabel(v),
                value: v,
              }))}
            />
          </Form.Item>

          {demountResolution === 'FULL_DEMOUNT' || demountResolution === 'REMOVE_SIM_ONLY' ? (
            <Form.Item label="Kategorija (brojilo ostaje bez SIM-a)" required>
              <Select
                placeholder="Odaberite kategoriju"
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
                  label: getMeterDemountCategoryLabel(v),
                  value: v,
                }))}
              />
            </Form.Item>
          ) : null}

          <Form.Item
            label="Obrazloženje"
            required
            validateStatus={demountReason.trim().length >= 3 ? undefined : 'error'}
            help={demountReason.trim().length >= 3 ? undefined : 'Unesite najmanje 3 znaka.'}
          >
            <Input.TextArea
              rows={3}
              value={demountReason}
              onChange={(e) => setDemountReason(e.target.value)}
              placeholder="Kratko obrazloženje odluke inicijatora"
            />
          </Form.Item>
        </Space>
      </Drawer>

      <Drawer
        title="Uredi brojilo"
        open={editDrawerOpen}
        width={560}
        onClose={() => setEditDrawerOpen(false)}
        destroyOnClose
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => setEditDrawerOpen(false)}>Odustani</Button>
            <Button type="primary" loading={updateMeterMutation.isPending} onClick={() => meterForm.submit()}>
              Snimi
            </Button>
          </div>
        }
      >
        <Form form={meterForm} layout="vertical" onFinish={handleMeterSubmit} className="mt-4">
          <Form.Item name="serialNumber" label="Serijski broj" rules={[{ required: true, message: 'Unesite serijski broj.' }]}>
            <Input placeholder="npr. AMM-12345" />
          </Form.Item>
          <Form.Item
            name="meterTypeDefinitionId"
            label="Tip brojila (katalog) *"
            rules={[{ required: true, message: 'Odaberite tip brojila.' }]}
          >
            <Select
              placeholder="Odaberi tip iz kataloga"
              options={meterTypesQuery.data?.map((t) => ({ label: t.name, value: t.id })) ?? []}
              loading={meterTypesQuery.isLoading}
            />
          </Form.Item>
          <Form.Item name="status" label="Status brojila">
            <Select
              options={[
                { label: 'Aktivno', value: 'ACTIVE' },
                { label: 'Neispravno', value: 'DEFECTIVE' },
                { label: 'Na baždarenju / servis', value: 'IN_CALIBRATION' },
                { label: 'Neaktivno', value: 'INACTIVE' },
              ]}
            />
          </Form.Item>
          <Form.Item name="year" label="Godina proizvodnje" rules={[{ required: true, message: 'Obavezno.' }]}>
            <InputNumber min={1970} max={2100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="calibrationYear" label="Godina baždarenja" rules={[{ required: true, message: 'Obavezno.' }]}>
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

          {meter?.meterTypeDefinitionId ? (
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
              {meterTypeFieldsQuery.isLoading ? (
                <div className="text-sm text-slate-500">Učitavanje polja…</div>
              ) : null}
            </div>
          ) : null}
        </Form>
      </Drawer>

      <Modal
        title="Brisanje brojila (SYSTEM_ADMIN)"
        open={deleteModalOpen}
        okText="Obriši"
        cancelText="Odustani"
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
          <Typography.Text type="secondary">Učitavanje veza…</Typography.Text>
        ) : deleteSummaryQuery.data ? (
          <div className="space-y-3">
            <Typography.Text>
              Brisanje će trajno ukloniti brojilo iz baze. Prije nastavka provjerite sve veze.
            </Typography.Text>

            <Card size="small" title="Veze">
              <div className="space-y-2">
                {deleteSummaryQuery.data.meter.hasOpenInstallTask ||
                deleteSummaryQuery.data.meter.hasOpenDemountTask ? (
                  <Typography.Text type="warning">
                    Upozorenje: brojilo ima otvoren nalog (
                    {deleteSummaryQuery.data.meter.hasOpenInstallTask ? 'ugradnja' : null}
                    {deleteSummaryQuery.data.meter.hasOpenInstallTask &&
                    deleteSummaryQuery.data.meter.hasOpenDemountTask
                      ? ' + '
                      : null}
                    {deleteSummaryQuery.data.meter.hasOpenDemountTask ? 'demontaža' : null}
                    ). Preporuka je prvo zatvoriti/otkazati naloge prije brisanja.
                  </Typography.Text>
                ) : null}

                <div>
                  <Typography.Text strong>SIM</Typography.Text>
                  <div className="mt-1">
                    {deleteSummaryQuery.data.simCard ? (
                      <div className="space-y-2">
                        <Typography.Text>
                          Ugrađena SIM: {deleteSummaryQuery.data.simCard.iccid} •{' '}
                          {deleteSummaryQuery.data.simCard.status}
                        </Typography.Text>
                        <Radio.Group
                          value={deleteSimAction}
                          onChange={(e) => setDeleteSimAction(e.target.value)}
                        >
                          <Space direction="vertical">
                            <Radio value="RETURN_SIM_TO_AVAILABLE">Vrati SIM u dostupne (AVAILABLE)</Radio>
                            <Radio value="DELETE_SIM">Obriši SIM iz baze</Radio>
                            <Radio value="LEAVE_AS_IS">Ne diraj SIM (nije preporučeno)</Radio>
                          </Space>
                        </Radio.Group>
                      </div>
                    ) : (
                      <Typography.Text type="secondary">Nema ugrađene SIM kartice.</Typography.Text>
                    )}
                  </div>
                </div>

                <div>
                  <Typography.Text strong>Zapisnici</Typography.Text>
                  <div className="mt-1 space-y-2">
                    <Typography.Text>
                      Ukupno: {deleteSummaryQuery.data.installationRecords.count}
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
                                      Foto {idx + 1}
                                    </Button>
                                  ))}
                                  {(r.photos ?? []).length > 5 ? (
                                    <Typography.Text type="secondary">
                                      +{(r.photos ?? []).length - 5} foto
                                    </Typography.Text>
                                  ) : null}
                                </Space>
                              ) : (
                                <Typography.Text type="secondary">Nema foto</Typography.Text>
                              )}
                            </Space>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <Typography.Text type="secondary">Nema zapisnika.</Typography.Text>
                    )}

                    <Radio.Group
                      value={deleteRecordsAction}
                      onChange={(e) => setDeleteRecordsAction(e.target.value)}
                    >
                      <Space direction="vertical">
                        <Radio value="ABORT_IF_EXISTS">
                          Ne briši zapisnike (blokiraj brisanje ako postoje)
                        </Radio>
                        <Radio value="DELETE_ALL">Obriši sve zapisnike (DB + fajlovi)</Radio>
                      </Space>
                    </Radio.Group>

                    {(deleteSummaryQuery.data.installationRecords.count ?? 0) > 0 &&
                    deleteRecordsAction !== 'DELETE_ALL' ? (
                      <Typography.Text type="warning">
                        Da biste obrisali brojilo, morate odabrati “Obriši sve zapisnike” (prethodno ručno preuzmite PDF/foto).
                      </Typography.Text>
                    ) : null}
                  </div>
                </div>

                <div>
                  <Typography.Text strong>Ostale veze</Typography.Text>
                  <div className="mt-1">
                    <ul className="list-disc pl-4 space-y-1">
                      <li>
                        Install taskovi: {deleteSummaryQuery.data.tasks.installTasksCount} (open:{' '}
                        {deleteSummaryQuery.data.meter.hasOpenInstallTask ? 'da' : 'ne'})
                      </li>
                      <li>
                        Demount taskovi: {deleteSummaryQuery.data.tasks.demountTasksCount} (open:{' '}
                        {deleteSummaryQuery.data.meter.hasOpenDemountTask ? 'da' : 'ne'})
                      </li>
                      <li>Branch ID: {deleteSummaryQuery.data.meter.branchId ?? '–'}</li>
                      <li>Tip brojila ID: {deleteSummaryQuery.data.meter.meterTypeDefinitionId}</li>
                    </ul>
                  </div>
                </div>
              </div>
            </Card>

            <Card size="small" title="Potvrda lozinkom">
              <Input.Password
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Unesite lozinku"
              />
              <Typography.Text type="secondary" className="block mt-2">
                Potvrda lozinkom je obavezna za konačno brisanje.
              </Typography.Text>
            </Card>
          </div>
        ) : (
          <Typography.Text type="danger">Nije moguće učitati podatke za brisanje.</Typography.Text>
        )}
      </Modal>
    </div>
  )
}
