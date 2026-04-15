import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Drawer, Form, Input, InputNumber, Select, Space, Switch, Table, Typography, message } from 'antd'
import { useMemo, useState } from 'react'
import { meterTypeDefinitionsApi } from '@/api/meter-type-definitions.api'
import type { MeterTypeDefinitionItem } from '@/types/meter-type-definition.types'
import type { MeterFieldType, MeterTypeFieldItem } from '@/types/meter-type-field.types'

const FIELD_TYPE_OPTIONS: { label: string; value: MeterFieldType }[] = [
  { label: 'String', value: 'STRING' },
  { label: 'Number', value: 'NUMBER' },
  { label: 'Boolean', value: 'BOOLEAN' },
  { label: 'Date', value: 'DATE' },
]

export default function MeterTypeFieldsPage() {
  const queryClient = useQueryClient()
  const [messageApi, messageContextHolder] = message.useMessage()

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
      messageApi.success('Polje je dodano.')
      setDrawerOpen(false)
      setEditing(null)
      form.resetFields()
      await queryClient.invalidateQueries({ queryKey: ['meter-type-definitions', 'fields'] })
    },
    onError: (e: unknown) => {
      messageApi.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Greška',
      )
    },
  })

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; data: Record<string, unknown> }) =>
      meterTypeDefinitionsApi.updateField(selectedTypeId!, payload.id, payload.data as any),
    onSuccess: async () => {
      messageApi.success('Polje je ažurirano.')
      setDrawerOpen(false)
      setEditing(null)
      form.resetFields()
      await queryClient.invalidateQueries({ queryKey: ['meter-type-definitions', 'fields'] })
    },
    onError: (e: unknown) => {
      messageApi.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Greška',
      )
    },
  })

  const removeMutation = useMutation({
    mutationFn: (fieldId: string) => meterTypeDefinitionsApi.removeField(selectedTypeId!, fieldId),
    onSuccess: async () => {
      messageApi.success('Polje je obrisano.')
      await queryClient.invalidateQueries({ queryKey: ['meter-type-definitions', 'fields'] })
    },
    onError: (e: unknown) => {
      messageApi.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Greška',
      )
    },
  })

  const reorderMutation = useMutation({
    mutationFn: (fieldIds: string[]) => meterTypeDefinitionsApi.reorderFields(selectedTypeId!, fieldIds),
    onSuccess: async () => {
      messageApi.success('Redoslijed je sačuvan.')
      await queryClient.invalidateQueries({ queryKey: ['meter-type-definitions', 'fields'] })
    },
    onError: (e: unknown) => {
      messageApi.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Greška',
      )
    },
  })

  const typeOptions = useMemo(
    () => (typesQuery.data ?? []).map((t: MeterTypeDefinitionItem) => ({ label: t.name, value: t.id })),
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
            Dinamička polja tipova brojila
          </Typography.Title>
          <Typography.Text type="secondary">
            Definiši dodatna polja po tipu brojila (validacija na kreiranju brojila/zapisnika).
          </Typography.Text>
        </div>
      </div>

      <Space wrap>
        <Select
          style={{ width: 320 }}
          placeholder="Odaberi tip brojila"
          options={typeOptions}
          value={selectedTypeId}
          onChange={(v) => setSelectedTypeId(v)}
          loading={typesQuery.isLoading}
          showSearch
          optionFilterProp="label"
        />
        <Button type="primary" disabled={!selectedTypeId} onClick={handleOpenCreate}>
          Dodaj polje
        </Button>
      </Space>

      <Table<MeterTypeFieldItem>
        rowKey="id"
        loading={fieldsQuery.isLoading}
        dataSource={fields}
        pagination={false}
        columns={[
          { title: 'Name', dataIndex: 'name', width: 180 },
          { title: 'Label', dataIndex: 'label' },
          { title: 'Type', dataIndex: 'fieldType', width: 110 },
          {
            title: 'Required',
            dataIndex: 'isRequired',
            width: 100,
            render: (v: boolean) => (v ? 'Da' : 'Ne'),
          },
          {
            title: 'Operator fill',
            dataIndex: 'isOperatorFillable',
            width: 120,
            render: (v: boolean) => (v ? 'Da' : 'Ne'),
          },
          { title: 'Default', dataIndex: 'defaultValue', width: 140, render: (v: string | null) => v ?? '–' },
          {
            title: 'Sort',
            dataIndex: 'sortOrder',
            width: 70,
          },
          {
            title: 'Akcije',
            width: 240,
            render: (_: unknown, row) => (
              <Space>
                <Button size="small" onClick={() => handleMove(row.id, -1)} disabled={reorderMutation.isPending}>
                  Gore
                </Button>
                <Button size="small" onClick={() => handleMove(row.id, 1)} disabled={reorderMutation.isPending}>
                  Dolje
                </Button>
                <Button size="small" onClick={() => handleOpenEdit(row)}>
                  Uredi
                </Button>
                <Button
                  size="small"
                  danger
                  onClick={() => removeMutation.mutate(row.id)}
                  loading={removeMutation.isPending}
                >
                  Obriši
                </Button>
              </Space>
            ),
          },
        ]}
      />

      <Drawer
        title={editing ? 'Uredi polje' : 'Novo polje'}
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
              Odustani
            </Button>
            <Button
              type="primary"
              loading={createMutation.isPending || updateMutation.isPending}
              onClick={() => form.submit()}
            >
              {editing ? 'Snimi' : 'Dodaj'}
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
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input placeholder="npr. transformer_ratio" />
          </Form.Item>
          <Form.Item name="label" label="Label" rules={[{ required: true }]}>
            <Input placeholder="npr. Prijenosni omjer" />
          </Form.Item>
          <Form.Item name="fieldType" label="Type" rules={[{ required: true }]}>
            <Select options={FIELD_TYPE_OPTIONS} />
          </Form.Item>
          <Space size="large" wrap>
            <Form.Item name="isRequired" label="Required" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="isOperatorFillable" label="Operator fill" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>
          <Form.Item name="defaultValue" label="Default value">
            <Input placeholder="Opcionalno" />
          </Form.Item>
          <Form.Item name="sortOrder" label="Sort order">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  )
}

