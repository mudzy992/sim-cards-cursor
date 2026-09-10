import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Drawer, Form, Input, InputNumber, Select, Space, Switch, Table, Typography, message } from 'antd'
import { useMemo, useState } from 'react'
import { meterTypeDefinitionsApi } from '@/api/meter-type-definitions.api'
import type { MeterTypeDefinitionItem } from '@/types/meter-type-definition.types'
import type { MeterFieldType, MeterTypeFieldItem } from '@/types/meter-type-field.types'
import { useTranslation } from '@/i18n'

export default function MeterTypeFieldsPage() {
  const queryClient = useQueryClient()
  const { t } = useTranslation();
  const [messageApi, messageContextHolder] = message.useMessage()

  const FIELD_TYPE_OPTIONS: { label: string; value: MeterFieldType }[] = [
    { label: t('meterTypeFields.fieldTypes.string'), value: 'STRING' },
    { label: t('meterTypeFields.fieldTypes.number'), value: 'NUMBER' },
    { label: t('meterTypeFields.fieldTypes.boolean'), value: 'BOOLEAN' },
    { label: t('meterTypeFields.fieldTypes.date'), value: 'DATE' },
  ]

  const [selectedTypeId, setSelectedTypeId] = useState<string | undefined>(undefined)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<MeterTypeFieldItem | null>(null)
  const [form] = Form.useForm<{
    name: string
    label: string
    fieldType: MeterFieldType
    isRequired?: boolean
    isOperatorFillable?: boolean
    defaultValue?: string
    sortOrder?: number
  }>()

  const typesQuery = useQuery({
    queryKey: ['meter-type-definitions', 'list-all'],
    queryFn: () => meterTypeDefinitionsApi.listAll(),
  })

  const fieldsQuery = useQuery({
    queryKey: ['meter-type-definitions', 'fields', selectedTypeId],
    queryFn: () => meterTypeDefinitionsApi.listFields(selectedTypeId!),
    enabled: Boolean(selectedTypeId),
  })

  const createMutation = useMutation({
    mutationFn: (values: Parameters<typeof meterTypeDefinitionsApi.createField>[1]) =>
      meterTypeDefinitionsApi.createField(selectedTypeId!, values),
    onSuccess: async () => {
      messageApi.success(t('meterTypeFields.messages.created'))
      setDrawerOpen(false)
      setEditing(null)
      form.resetFields()
      await queryClient.invalidateQueries({ queryKey: ['meter-type-definitions', 'fields'] })
    },
    onError: (e: unknown) => {
      messageApi.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('common.states.error'),
      )
    },
  })

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; data: Record<string, unknown> }) =>
      meterTypeDefinitionsApi.updateField(selectedTypeId!, payload.id, payload.data as any),
    onSuccess: async () => {
      messageApi.success(t('meterTypeFields.messages.updated'))
      setDrawerOpen(false)
      setEditing(null)
      form.resetFields()
      await queryClient.invalidateQueries({ queryKey: ['meter-type-definitions', 'fields'] })
    },
    onError: (e: unknown) => {
      messageApi.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('common.states.error'),
      )
    },
  })

  const removeMutation = useMutation({
    mutationFn: (fieldId: string) => meterTypeDefinitionsApi.removeField(selectedTypeId!, fieldId),
    onSuccess: async () => {
      messageApi.success(t('meterTypeFields.messages.deleted'))
      await queryClient.invalidateQueries({ queryKey: ['meter-type-definitions', 'fields'] })
    },
    onError: (e: unknown) => {
      messageApi.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('common.states.error'),
      )
    },
  })

  const reorderMutation = useMutation({
    mutationFn: (fieldIds: string[]) => meterTypeDefinitionsApi.reorderFields(selectedTypeId!, fieldIds),
    onSuccess: async () => {
      messageApi.success(t('meterTypeFields.messages.reordered'))
      await queryClient.invalidateQueries({ queryKey: ['meter-type-definitions', 'fields'] })
    },
    onError: (e: unknown) => {
      messageApi.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('common.states.error'),
      )
    },
  })

  const typeOptions = useMemo(
    () => (typesQuery.data ?? []).map((mtd: MeterTypeDefinitionItem) => ({ label: mtd.name, value: mtd.id })),
    [typesQuery.data],
  )

  const fields = (fieldsQuery.data ?? []).slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

  const handleOpenCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ fieldType: 'STRING', isRequired: false, isOperatorFillable: false })
    setDrawerOpen(true)
  }

  const handleOpenEdit = (row: MeterTypeFieldItem) => {
    setEditing(row)
    form.setFieldsValue({
      name: row.name,
      label: row.label,
      fieldType: row.fieldType,
      isRequired: row.isRequired,
      isOperatorFillable: row.isOperatorFillable,
      defaultValue: row.defaultValue ?? undefined,
      sortOrder: row.sortOrder,
    })
    setDrawerOpen(true)
  }

  const handleMove = (fieldId: string, dir: -1 | 1) => {
    const idx = fields.findIndex((f) => f.id === fieldId)
    if (idx < 0) return
    const nextIdx = idx + dir
    if (nextIdx < 0 || nextIdx >= fields.length) return
    const next = fields.slice()
    const tmp = next[idx]
    next[idx] = next[nextIdx]
    next[nextIdx] = tmp
    reorderMutation.mutate(next.map((f) => f.id))
  }

  return (
    <div className="space-y-4">
      {messageContextHolder}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Typography.Title level={3} className="!mb-0">
            {t('meterTypeFields.title')}
          </Typography.Title>
          <Typography.Text type="secondary">
            {t('meterTypeFields.subtitle')}
          </Typography.Text>
        </div>
      </div>

      <Space wrap>
        <Select
          style={{ width: 320 }}
          placeholder={t('meterTypeFields.selectTypePlaceholder')}
          options={typeOptions}
          value={selectedTypeId}
          onChange={(v) => setSelectedTypeId(v)}
          loading={typesQuery.isLoading}
          showSearch
          optionFilterProp="label"
        />
        <Button type="primary" disabled={!selectedTypeId} onClick={handleOpenCreate}>
          {t('meterTypeFields.addField')}
        </Button>
      </Space>

      <Table<MeterTypeFieldItem>
        rowKey="id"
        loading={fieldsQuery.isLoading}
        dataSource={fields}
        pagination={false}
        columns={[
          { title: t('meterTypeFields.columns.name'), dataIndex: 'name', width: 180 },
          { title: t('meterTypeFields.columns.label'), dataIndex: 'label' },
          { title: t('common.labels.type'), dataIndex: 'fieldType', width: 110 },
          {
            title: t('meterTypeFields.columns.required'),
            dataIndex: 'isRequired',
            width: 100,
            render: (v: boolean) => (v ? t('common.actions.yes') : t('common.actions.no')),
          },
          {
            title: t('meterTypeFields.columns.operatorFill'),
            dataIndex: 'isOperatorFillable',
            width: 120,
            render: (v: boolean) => (v ? t('common.actions.yes') : t('common.actions.no')),
          },
          { title: t('meterTypeFields.columns.default'), dataIndex: 'defaultValue', width: 140, render: (v: string | null) => v ?? '–' },
          {
            title: t('meterTypeFields.columns.sort'),
            dataIndex: 'sortOrder',
            width: 70,
          },
          {
            title: t('common.actions.actions'),
            width: 240,
            render: (_: unknown, row) => (
              <Space>
                <Button size="small" onClick={() => handleMove(row.id, -1)} disabled={reorderMutation.isPending}>
                  {t('meterTypeFields.moveUp')}
                </Button>
                <Button size="small" onClick={() => handleMove(row.id, 1)} disabled={reorderMutation.isPending}>
                  {t('meterTypeFields.moveDown')}
                </Button>
                <Button size="small" onClick={() => handleOpenEdit(row)}>
                  {t('common.actions.edit')}
                </Button>
                <Button
                  size="small"
                  danger
                  onClick={() => removeMutation.mutate(row.id)}
                  loading={removeMutation.isPending}
                >
                  {t('common.actions.delete')}
                </Button>
              </Space>
            ),
          },
        ]}
      />

      <Drawer
        title={editing ? t('meterTypeFields.editFieldTitle') : t('meterTypeFields.newFieldTitle')}
        open={drawerOpen}
        width={520}
        onClose={() => {
          setDrawerOpen(false)
          setEditing(null)
          form.resetFields()
        }}
        destroyOnClose
        footer={
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                setDrawerOpen(false)
                setEditing(null)
                form.resetFields()
              }}
            >
              {t('common.actions.cancel')}
            </Button>
            <Button
              type="primary"
              loading={createMutation.isPending || updateMutation.isPending}
              onClick={() => form.submit()}
            >
              {editing ? t('common.actions.save') : t('common.actions.add')}
            </Button>
          </div>
        }
      >
        <Form
          form={form}
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
            if (editing) {
              updateMutation.mutate({ id: editing.id, data: payload })
              return
            }
            createMutation.mutate(payload as any)
          }}
        >
          <Form.Item name="name" label={t('meterTypeFields.columns.name')} rules={[{ required: true }]}>
            <Input placeholder={t('meterTypeFields.namePlaceholder')} />
          </Form.Item>
          <Form.Item name="label" label={t('meterTypeFields.columns.label')} rules={[{ required: true }]}>
            <Input placeholder={t('meterTypeFields.labelPlaceholder')} />
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
