import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownOutlined, ArrowUpOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, Divider, Drawer, Form, Input, InputNumber, Select, Space, Switch, Table, Typography, message } from 'antd'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { meterTypeDefinitionsApi } from '@/api/meter-type-definitions.api'
import type { CreateMeterTypeDefinitionInput, MeterType, MeterTypeDefinitionItem } from '@/types/meter-type-definition.types'
import type { MeterFieldType, MeterTypeFieldItem } from '@/types/meter-type-field.types'

const meterTypeOptions: { label: string; value: MeterType }[] = [
  { label: 'Jednofazno', value: 'SINGLE_PHASE' },
  { label: 'Trofazno', value: 'THREE_PHASE' },
]

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

export default function MeterTypeUpsertPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [messageApi, messageContextHolder] = message.useMessage()
  const params = useParams()
  const definitionId = params.id

  const [typeForm] = Form.useForm<TypeFormValues>()
  const [fieldForm] = Form.useForm<FieldFormValues>()
  const [fieldDrawerOpen, setFieldDrawerOpen] = useState(false)
  const [editingField, setEditingField] = useState<MeterTypeFieldItem | null>(null)

  const isCreate = !definitionId

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
      messageApi.success(isCreate ? 'Tip brojila je kreiran.' : 'Tip brojila je ažuriran.')
      await queryClient.invalidateQueries({ queryKey: ['meter-type-definitions'] })
      if (!definitionId) {
        navigate(`/meter-types/${data.id}`, { replace: true })
        return
      }
      await queryClient.invalidateQueries({ queryKey: ['meter-type-definitions', 'get', definitionId] })
    },
    onError: (e: unknown) => {
      messageApi.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Greška',
      )
    },
  })

  const createFieldMutation = useMutation({
    mutationFn: (values: Parameters<typeof meterTypeDefinitionsApi.createField>[1]) =>
      meterTypeDefinitionsApi.createField(definitionId!, values),
    onSuccess: async () => {
      messageApi.success('Polje je dodano.')
      setFieldDrawerOpen(false)
      setEditingField(null)
      fieldForm.resetFields()
      await queryClient.invalidateQueries({ queryKey: ['meter-type-definitions', 'fields', definitionId] })
    },
    onError: (e: unknown) => {
      messageApi.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Greška',
      )
    },
  })

  const updateFieldMutation = useMutation({
    mutationFn: (payload: { id: string; data: Record<string, unknown> }) =>
      meterTypeDefinitionsApi.updateField(definitionId!, payload.id, payload.data as any),
    onSuccess: async () => {
      messageApi.success('Polje je ažurirano.')
      setFieldDrawerOpen(false)
      setEditingField(null)
      fieldForm.resetFields()
      await queryClient.invalidateQueries({ queryKey: ['meter-type-definitions', 'fields', definitionId] })
    },
    onError: (e: unknown) => {
      messageApi.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Greška',
      )
    },
  })

  const removeFieldMutation = useMutation({
    mutationFn: (fieldId: string) => meterTypeDefinitionsApi.removeField(definitionId!, fieldId),
    onSuccess: async () => {
      messageApi.success('Polje je obrisano.')
      await queryClient.invalidateQueries({ queryKey: ['meter-type-definitions', 'fields', definitionId] })
    },
    onError: (e: unknown) => {
      messageApi.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Greška',
      )
    },
  })

  const reorderFieldsMutation = useMutation({
    mutationFn: (fieldIds: string[]) => meterTypeDefinitionsApi.reorderFields(definitionId!, fieldIds),
    onSuccess: async () => {
      messageApi.success('Redoslijed je sačuvan.')
      await queryClient.invalidateQueries({ queryKey: ['meter-type-definitions', 'fields', definitionId] })
    },
    onError: (e: unknown) => {
      messageApi.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Greška',
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

  return (
    <div className="space-y-4">
      {messageContextHolder}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Typography.Title level={3} className="!mb-0">
            {isCreate ? 'Novi tip brojila' : 'Uredi tip brojila'}
          </Typography.Title>
          <Typography.Text type="secondary">
            Definiši tip brojila i dodatna polja koja se vežu za taj tip.
          </Typography.Text>
        </div>
        <Space>
          <Button onClick={() => navigate('/meters')}>Nazad</Button>
          <Button type="primary" loading={upsertMutation.isPending} onClick={() => typeForm.submit()}>
            {isCreate ? 'Kreiraj tip' : 'Snimi'}
          </Button>
        </Space>
      </div>

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
          <Form.Item name="name" label="Naziv" rules={[{ required: true, message: 'Unesite naziv.' }]}>
            <Input placeholder="npr. AMM 3.0" />
          </Form.Item>
          <Form.Item name="type" label="Tip">
            <Select allowClear placeholder="Odaberi" options={meterTypeOptions} />
          </Form.Item>
          <Form.Item name="manufacturer" label="Proizvođač">
            <Input placeholder="Opcionalno" />
          </Form.Item>
          <Form.Item name="model" label="Model">
            <Input placeholder="Opcionalno" />
          </Form.Item>
          <Form.Item name="maxCurrent" label="Maks. struja (A)">
            <Input placeholder="Opcionalno" />
          </Form.Item>
        </div>
        <Form.Item name="notes" label="Napomena">
          <Input.TextArea rows={2} placeholder="Opcionalno" />
        </Form.Item>
      </Form>

      <Divider className="!my-2" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Typography.Title level={5} className="!mb-0">
            Dodatna polja
          </Typography.Title>
          <Typography.Text type="secondary">
            Polja su aktivna tek nakon što tip bude sačuvan.
          </Typography.Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          disabled={!definitionId}
          onClick={handleOpenCreateField}
        >
          Dodaj polje
        </Button>
      </div>

      <Table<MeterTypeFieldItem>
        rowKey="id"
        loading={fieldsQuery.isLoading}
        dataSource={fields}
        pagination={false}
        columns={[
          { title: 'Name', dataIndex: 'name', width: 180 },
          { title: 'Label', dataIndex: 'label' },
          { title: 'Type', dataIndex: 'fieldType', width: 110 },
          { title: 'Required', dataIndex: 'isRequired', width: 100, render: (v: boolean) => (v ? 'Da' : 'Ne') },
          {
            title: 'Operator fill',
            dataIndex: 'isOperatorFillable',
            width: 120,
            render: (v: boolean) => (v ? 'Da' : 'Ne'),
          },
          { title: 'Default', dataIndex: 'defaultValue', width: 140, render: (v: string | null) => v ?? '–' },
          { title: 'Sort', dataIndex: 'sortOrder', width: 70 },
          {
            title: 'Akcije',
            width: 260,
            render: (_: unknown, row) => (
              <Space>
                <Button
                  size="small"
                  icon={<ArrowUpOutlined />}
                  onClick={() => handleMoveField(row.id, -1)}
                  disabled={reorderFieldsMutation.isPending}
                >
                  Gore
                </Button>
                <Button
                  size="small"
                  icon={<ArrowDownOutlined />}
                  onClick={() => handleMoveField(row.id, 1)}
                  disabled={reorderFieldsMutation.isPending}
                >
                  Dolje
                </Button>
                <Button size="small" onClick={() => handleOpenEditField(row)}>
                  Uredi
                </Button>
                <Button
                  size="small"
                  danger
                  onClick={() => removeFieldMutation.mutate(row.id)}
                  loading={removeFieldMutation.isPending}
                >
                  Obriši
                </Button>
              </Space>
            ),
          },
        ]}
      />

      <Drawer
        title={editingField ? 'Uredi polje' : 'Novo polje'}
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
              Odustani
            </Button>
            <Button
              type="primary"
              loading={createFieldMutation.isPending || updateFieldMutation.isPending}
              onClick={() => fieldForm.submit()}
            >
              {editingField ? 'Snimi' : 'Dodaj'}
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

