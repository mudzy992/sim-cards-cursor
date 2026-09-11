import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownOutlined, ArrowUpOutlined, PlusOutlined } from '@ant-design/icons'
import {
  Button,
  Descriptions,
  Divider,
  Drawer,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Switch,
  Table,
  Typography,
  message,
} from 'antd'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { meterTypeDefinitionsApi } from '@/api/meter-type-definitions.api'
import type { CreateMeterTypeDefinitionInput, MeterType, MeterTypeDefinitionItem } from '@/types/meter-type-definition.types'
import type { MeterFieldType, MeterTypeFieldItem } from '@/types/meter-type-field.types'
import { useTranslation } from '@/i18n'

function getMeterTypeOptions(t: (key: string) => string): { label: string; value: MeterType }[] {
  return [
    { label: t('meterTypes.phaseSingle'), value: 'SINGLE_PHASE' },
    { label: t('meterTypes.phaseThree'), value: 'THREE_PHASE' },
  ]
}

const FIELD_TYPE_OPTIONS: { label: string; value: MeterFieldType }[] = [
  { label: 'String', value: 'STRING' },
  { label: 'Number', value: 'NUMBER' },
  { label: 'Boolean', value: 'BOOLEAN' },
  { label: 'Date', value: 'DATE' },
]

type TypeFormValues = {
  name: string
  manufacturer?: string
  model?: string
  type?: MeterType
  maxCurrent?: string
  notes?: string
}

type FieldFormValues = {
  name: string
  label: string
  fieldType: MeterFieldType
  isRequired?: boolean
  isOperatorFillable?: boolean
  defaultValue?: string
  sortOrder?: number
}

function renderMeterPhaseLabel(mt: MeterType | undefined, t: (key: string) => string) {
  if (mt === 'SINGLE_PHASE') return t('meterTypes.phaseSingle')
  if (mt === 'THREE_PHASE') return t('meterTypes.phaseThree')
  return '–'
}

export default function MeterTypeUpsertPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { t } = useTranslation();
  const meterTypeOptions = getMeterTypeOptions(t)
  const [messageApi, messageContextHolder] = message.useMessage()
  const params = useParams()
  const definitionId = params.id
  const userRole = useAuthStore((s) => s.user?.role)
  const canEditMeterTypes = userRole === 'SYSTEM_ADMIN'

  const [typeForm] = Form.useForm<TypeFormValues>()
  const [fieldForm] = Form.useForm<FieldFormValues>()
  const [fieldDrawerOpen, setFieldDrawerOpen] = useState(false)
  const [editingField, setEditingField] = useState<MeterTypeFieldItem | null>(null)

  const isCreate = !definitionId
  const readOnlyMode = Boolean(definitionId) && !canEditMeterTypes

  const typeQuery = useQuery({
    queryKey: ['meter-type-definitions', 'get', definitionId],
    queryFn: () => meterTypeDefinitionsApi.get(definitionId!),
    enabled: Boolean(definitionId),
  })

  const fieldsQuery = useQuery({
    queryKey: ['meter-type-definitions', 'fields', definitionId],
    queryFn: () => meterTypeDefinitionsApi.listFields(definitionId!),
    enabled: Boolean(definitionId),
  })

  const upsertMutation = useMutation({
    mutationFn: async (values: TypeFormValues): Promise<MeterTypeDefinitionItem> => {
      const payload: CreateMeterTypeDefinitionInput = {
        name: values.name.trim(),
        manufacturer: values.manufacturer?.trim() || undefined,
        model: values.model?.trim() || undefined,
        type: values.type,
        maxCurrent: values.maxCurrent?.trim() || undefined,
        notes: values.notes?.trim() || undefined,
      }
      if (definitionId) return meterTypeDefinitionsApi.update(definitionId, payload)
      return meterTypeDefinitionsApi.create(payload)
    },
    onSuccess: async (data) => {
      messageApi.success(isCreate ? t('meterTypes.created') : t('meterTypes.updated'))
      await queryClient.invalidateQueries({ queryKey: ['meter-type-definitions'] })
      if (!definitionId) {
        navigate(`/meter-types/${data.id}`, { replace: true })
        return
      }
      await queryClient.invalidateQueries({ queryKey: ['meter-type-definitions', 'get', definitionId] })
    },
    onError: (e: unknown) => {
      messageApi.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('common.states.error'),
      )
    },
  })

  const createFieldMutation = useMutation({
    mutationFn: (values: Parameters<typeof meterTypeDefinitionsApi.createField>[1]) =>
      meterTypeDefinitionsApi.createField(definitionId!, values),
    onSuccess: async () => {
      messageApi.success(t('meterTypeFields.messages.created'))
      setFieldDrawerOpen(false)
      setEditingField(null)
      fieldForm.resetFields()
      await queryClient.invalidateQueries({ queryKey: ['meter-type-definitions', 'fields', definitionId] })
    },
    onError: (e: unknown) => {
      messageApi.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('common.states.error'),
      )
    },
  })

  const updateFieldMutation = useMutation({
    mutationFn: (payload: { id: string; data: Record<string, unknown> }) =>
      meterTypeDefinitionsApi.updateField(definitionId!, payload.id, payload.data as any),
    onSuccess: async () => {
      messageApi.success(t('meterTypeFields.messages.updated'))
      setFieldDrawerOpen(false)
      setEditingField(null)
      fieldForm.resetFields()
      await queryClient.invalidateQueries({ queryKey: ['meter-type-definitions', 'fields', definitionId] })
    },
    onError: (e: unknown) => {
      messageApi.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('common.states.error'),
      )
    },
  })

  const removeFieldMutation = useMutation({
    mutationFn: (fieldId: string) => meterTypeDefinitionsApi.removeField(definitionId!, fieldId),
    onSuccess: async () => {
      messageApi.success(t('meterTypeFields.messages.deleted'))
      await queryClient.invalidateQueries({ queryKey: ['meter-type-definitions', 'fields', definitionId] })
    },
    onError: (e: unknown) => {
      messageApi.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('common.states.error'),
      )
    },
  })

  const reorderFieldsMutation = useMutation({
    mutationFn: (fieldIds: string[]) => meterTypeDefinitionsApi.reorderFields(definitionId!, fieldIds),
    onSuccess: async () => {
      messageApi.success(t('meterTypeFields.messages.reordered'))
      await queryClient.invalidateQueries({ queryKey: ['meter-type-definitions', 'fields', definitionId] })
    },
    onError: (e: unknown) => {
      messageApi.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('common.states.error'),
      )
    },
  })

  const fields = useMemo(() => {
    return (fieldsQuery.data ?? []).slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  }, [fieldsQuery.data])

  const handleOpenCreateField = () => {
    setEditingField(null)
    fieldForm.resetFields()
    fieldForm.setFieldsValue({ fieldType: 'STRING', isRequired: false, isOperatorFillable: false })
    setFieldDrawerOpen(true)
  }

  const handleOpenEditField = (row: MeterTypeFieldItem) => {
    setEditingField(row)
    fieldForm.setFieldsValue({
      name: row.name,
      label: row.label,
      fieldType: row.fieldType,
      isRequired: row.isRequired,
      isOperatorFillable: row.isOperatorFillable,
      defaultValue: row.defaultValue ?? undefined,
      sortOrder: row.sortOrder,
    })
    setFieldDrawerOpen(true)
  }

  const handleMoveField = (fieldId: string, dir: -1 | 1) => {
    const idx = fields.findIndex((f) => f.id === fieldId)
    if (idx < 0) return
    const nextIdx = idx + dir
    if (nextIdx < 0 || nextIdx >= fields.length) return
    const next = fields.slice()
    const tmp = next[idx]
    next[idx] = next[nextIdx]
    next[nextIdx] = tmp
    reorderFieldsMutation.mutate(next.map((f) => f.id))
  }

  const fieldsColumnsReadOnly = [
    { title: t('meterTypeFields.columns.name'), dataIndex: 'name', width: 180 },
    { title: t('meterTypeFields.columns.label'), dataIndex: 'label' },
    { title: t('common.labels.type'), dataIndex: 'fieldType', width: 110 },
    { title: t('meterTypeFields.columns.required'), dataIndex: 'isRequired', width: 100, render: (v: boolean) => (v ? t('common.actions.yes') : t('common.actions.no')) },
    {
      title: t('meterTypeFields.columns.operatorFill'),
      dataIndex: 'isOperatorFillable',
      width: 140,
      render: (v: boolean) => (v ? t('common.actions.yes') : t('common.actions.no')),
    },
    { title: t('meterTypeFields.columns.default'), dataIndex: 'defaultValue', width: 140, render: (v: string | null) => v ?? '–' },
    { title: t('meterTypeFields.columns.sort'), dataIndex: 'sortOrder', width: 90 },
  ]

  const fieldsColumnsEditable = [
    ...fieldsColumnsReadOnly,
    {
      title: t('common.actions.actions'),
      width: 260,
      render: (_: unknown, row: MeterTypeFieldItem) => (
        <Space>
          <Button
            size="small"
            icon={<ArrowUpOutlined />}
            onClick={() => handleMoveField(row.id, -1)}
            disabled={reorderFieldsMutation.isPending}
          >
            {t('meterTypeFields.moveUp')}
          </Button>
          <Button
            size="small"
            icon={<ArrowDownOutlined />}
            onClick={() => handleMoveField(row.id, 1)}
            disabled={reorderFieldsMutation.isPending}
          >
            {t('meterTypeFields.moveDown')}
          </Button>
          <Button size="small" onClick={() => handleOpenEditField(row)}>
            {t('common.actions.edit')}
          </Button>
          <Button
            size="small"
            danger
            onClick={() => removeFieldMutation.mutate(row.id)}
            loading={removeFieldMutation.isPending}
          >
            {t('common.actions.delete')}
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      {messageContextHolder}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Typography.Title level={3} className="!mb-0">
            {isCreate ? t('meterTypes.newTitle') : readOnlyMode ? t('meterTypes.detailsTitle') : t('meterTypes.editTitle')}
          </Typography.Title>
          <Typography.Text type="secondary">
            {readOnlyMode
              ? t('meterTypes.readOnlyIntro')
              : t('meterTypes.editIntro')}
          </Typography.Text>
        </div>
        <Space>
          <Button onClick={() => navigate('/meters')}>{t('common.actions.back')}</Button>
          {!readOnlyMode && (
            <Button type="primary" loading={upsertMutation.isPending} onClick={() => typeForm.submit()}>
              {isCreate ? t('meterTypes.createButton') : t('common.actions.save')}
            </Button>
          )}
        </Space>
      </div>

      {readOnlyMode ? (
        <>
          {typeQuery.isError && (
            <Typography.Text type="danger">
              {(typeQuery.error as { response?: { data?: { message?: string } } })?.response?.data
                ?.message ?? t('meterTypes.loadFailed')}
            </Typography.Text>
          )}
          {typeQuery.isLoading && <Typography.Text type="secondary">{t('common.states.loading')}</Typography.Text>}
          {typeQuery.data && (
            <Descriptions bordered column={{ xs: 1, sm: 1, md: 2 }} size="small">
              <Descriptions.Item label={t('common.labels.name')}>{typeQuery.data.name}</Descriptions.Item>
              <Descriptions.Item label={t('meterTypes.phaseColumn')}>
                {renderMeterPhaseLabel(typeQuery.data.type, t)}
              </Descriptions.Item>
              <Descriptions.Item label={t('meterTypes.manufacturer')}>{typeQuery.data.manufacturer ?? '–'}</Descriptions.Item>
              <Descriptions.Item label={t('meterTypes.model')}>{typeQuery.data.model ?? '–'}</Descriptions.Item>
              <Descriptions.Item label={t('meterTypes.maxCurrent')}>{typeQuery.data.maxCurrent ?? '–'}</Descriptions.Item>
              <Descriptions.Item label={t('common.labels.notes')} span={2}>
                {typeQuery.data.notes ?? '–'}
              </Descriptions.Item>
            </Descriptions>
          )}
          <Divider className="!my-2" />
          <Typography.Title level={5} className="!mb-2">
            {t('meterTypes.extraFieldsTitle')}
          </Typography.Title>
          <Typography.Paragraph type="secondary" className="!mb-4 !mt-0">
            {t('meterTypes.extraFieldsIntro')}
          </Typography.Paragraph>
          <Table<MeterTypeFieldItem>
            rowKey="id"
            loading={fieldsQuery.isLoading}
            dataSource={fields}
            pagination={false}
            columns={fieldsColumnsReadOnly}
          />
        </>
      ) : (
        <>
          <Form
            form={typeForm}
            layout="vertical"
            onFinish={(values) => upsertMutation.mutate(values)}
            initialValues={{
              name: '',
              manufacturer: '',
              model: '',
              type: undefined,
              maxCurrent: '',
              notes: '',
            }}
            fields={
              typeQuery.data
                ? ([
                    { name: 'name', value: typeQuery.data.name },
                    { name: 'manufacturer', value: typeQuery.data.manufacturer ?? '' },
                    { name: 'model', value: typeQuery.data.model ?? '' },
                    { name: 'type', value: typeQuery.data.type },
                    { name: 'maxCurrent', value: typeQuery.data.maxCurrent ?? '' },
                    { name: 'notes', value: typeQuery.data.notes ?? '' },
                  ] as any)
                : undefined
            }
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Form.Item name="name" label={t('common.labels.name')} rules={[{ required: true, message: t('meterTypes.nameRequired') }]}>
                <Input placeholder="npr. AMM 3.0" />
              </Form.Item>
              <Form.Item name="type" label={t('common.labels.type')}>
                <Select allowClear placeholder={t('common.actions.select')} options={meterTypeOptions} />
              </Form.Item>
              <Form.Item name="manufacturer" label={t('meterTypes.manufacturer')}>
                <Input placeholder={t('common.labels.optional')} />
              </Form.Item>
              <Form.Item name="model" label={t('meterTypes.model')}>
                <Input placeholder={t('common.labels.optional')} />
              </Form.Item>
              <Form.Item name="maxCurrent" label={t('meterTypes.maxCurrent')}>
                <Input placeholder={t('common.labels.optional')} />
              </Form.Item>
            </div>
            <Form.Item name="notes" label={t('common.labels.notes')}>
              <Input.TextArea rows={2} placeholder={t('common.labels.optional')} />
            </Form.Item>
          </Form>

          <Divider className="!my-2" />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Typography.Title level={5} className="!mb-0">
                {t('meterTypes.extraFieldsTitle')}
              </Typography.Title>
              <Typography.Text type="secondary">
                {t('meterTypes.extraFieldsActiveAfterSave')}
              </Typography.Text>
            </div>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              disabled={!definitionId}
              onClick={handleOpenCreateField}
            >
              {t('meterTypeFields.addField')}
            </Button>
          </div>

          <Table<MeterTypeFieldItem>
            rowKey="id"
            loading={fieldsQuery.isLoading}
            dataSource={fields}
            pagination={false}
            columns={fieldsColumnsEditable}
          />
        </>
      )}

      <Drawer
        title={editingField ? t('meterTypeFields.editFieldTitle') : t('meterTypeFields.newFieldTitle')}
        open={fieldDrawerOpen}
        width={520}
        onClose={() => {
          setFieldDrawerOpen(false)
          setEditingField(null)
          fieldForm.resetFields()
        }}
        destroyOnClose
        footer={
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                setFieldDrawerOpen(false)
                setEditingField(null)
                fieldForm.resetFields()
              }}
            >
              {t('common.actions.cancel')}
            </Button>
            <Button
              type="primary"
              loading={createFieldMutation.isPending || updateFieldMutation.isPending}
              onClick={() => fieldForm.submit()}
            >
              {editingField ? t('common.actions.save') : t('common.actions.add')}
            </Button>
          </div>
        }
      >
        <Form
          form={fieldForm}
          layout="vertical"
          onFinish={(values) => {
            const payload = {
              name: values.name.trim(),
              label: values.label.trim(),
              fieldType: values.fieldType,
              isRequired: Boolean(values.isRequired),
              isOperatorFillable: Boolean(values.isOperatorFillable),
              defaultValue: values.defaultValue?.trim() || undefined,
              sortOrder: values.sortOrder ?? undefined,
            }
            if (editingField) {
              updateFieldMutation.mutate({ id: editingField.id, data: payload })
              return
            }
            createFieldMutation.mutate(payload as any)
          }}
        >
          <Form.Item name="name" label={t('meterTypeFields.columns.name')} rules={[{ required: true }]}>
            <Input placeholder="npr. transformer_ratio" />
          </Form.Item>
          <Form.Item name="label" label={t('meterTypeFields.columns.label')} rules={[{ required: true }]}>
            <Input placeholder="npr. Prijenosni omjer" />
          </Form.Item>
          <Form.Item name="fieldType" label={t('common.labels.type')} rules={[{ required: true }]}>
            <Select options={FIELD_TYPE_OPTIONS} />
          </Form.Item>
          <Space size="large" wrap>
            <Form.Item name="isRequired" label={t('meterTypeFields.columns.required')} valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="isOperatorFillable" label={t('meterTypeFields.columns.operatorFill')} valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>
          <Form.Item name="defaultValue" label={t('meterTypeFields.defaultValueLabel')}>
            <Input placeholder={t('common.labels.optional')} />
          </Form.Item>
          <Form.Item name="sortOrder" label={t('meterTypeFields.sortOrderLabel')}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  )
}

