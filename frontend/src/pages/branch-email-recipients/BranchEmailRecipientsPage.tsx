import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Drawer, Form, Input, Select, Space, Switch, Table, Tag, Typography, message } from 'antd'
import { useMemo, useState } from 'react'
import { branchEmailRecipientsApi } from '@/api/branch-email-recipients.api'
import { branchModeratorsApi } from '@/api/branch-moderators.api'
import { branchesApi } from '@/api/branches.api'
import { useAuthStore } from '@/store/auth.store'
import type { BranchEmailRecipientItem } from '@/types/branch-email-recipient.types'

export default function BranchEmailRecipientsPage() {
  const queryClient = useQueryClient()
  const [messageApi, messageContextHolder] = message.useMessage()
  const userDistributionId = useAuthStore((s) => s.user?.distributionId)

  const [branchIdFilter, setBranchIdFilter] = useState<string | undefined>(undefined)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<BranchEmailRecipientItem | null>(null)
  const [form] = Form.useForm<{ branchId: string; email: string; label?: string; isActive?: boolean }>()

  const branchesQuery = useQuery({
    queryKey: ['branches', 'list', userDistributionId],
    queryFn: () => branchesApi.list(userDistributionId ?? undefined),
  })

  const listQuery = useQuery({
    queryKey: ['branch-email-recipients', 'list', branchIdFilter],
    queryFn: () => branchEmailRecipientsApi.list(branchIdFilter ? { branchId: branchIdFilter } : undefined),
  })

  const moderatorsQuery = useQuery({
    queryKey: ['branch-moderators', 'list', 'for-email-recipients', branchIdFilter],
    queryFn: () => branchModeratorsApi.list(branchIdFilter ? { branchId: branchIdFilter } : undefined),
  })

  const createMutation = useMutation({
    mutationFn: (values: { branchId: string; email: string; label?: string }) =>
      branchEmailRecipientsApi.create(values),
    onSuccess: async () => {
      messageApi.success('Primalac je dodan.')
      setDrawerOpen(false)
      setEditing(null)
      form.resetFields()
      await queryClient.invalidateQueries({ queryKey: ['branch-email-recipients'] })
    },
    onError: (e: unknown) => {
      messageApi.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Greška',
      )
    },
  })

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; data: { email?: string; label?: string; isActive?: boolean } }) =>
      branchEmailRecipientsApi.update(payload.id, payload.data),
    onSuccess: async () => {
      messageApi.success('Primalac je ažuriran.')
      setDrawerOpen(false)
      setEditing(null)
      form.resetFields()
      await queryClient.invalidateQueries({ queryKey: ['branch-email-recipients'] })
    },
    onError: (e: unknown) => {
      messageApi.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Greška',
      )
    },
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => branchEmailRecipientsApi.remove(id),
    onSuccess: async () => {
      messageApi.success('Primalac je obrisan.')
      await queryClient.invalidateQueries({ queryKey: ['branch-email-recipients'] })
    },
    onError: (e: unknown) => {
      messageApi.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Greška',
      )
    },
  })

  const branchOptions = useMemo(
    () =>
      (branchesQuery.data ?? []).map((b) => ({
        label: `${b.name} (${b.code})`,
        value: b.id,
      })),
    [branchesQuery.data],
  )

  const groupedModerators = useMemo(() => {
    const items = moderatorsQuery.data ?? []
    const byUser = new Map<
      string,
      {
        key: string
        userLabel: string
        branches: Array<{ id: string; label: string }>
      }
    >()

    for (const item of items) {
      const key = item.user?.id ?? item.userId
      const userLabel = item.user
        ? `${item.user.firstName} ${item.user.lastName}${item.user.email ? ` (${item.user.email})` : ''}`
        : item.userId

      const branch = item.branch
        ? { id: item.branch.id, label: `${item.branch.name} (${item.branch.code})` }
        : null

      const existing = byUser.get(key)
      if (!existing) {
        byUser.set(key, { key, userLabel, branches: branch ? [branch] : [] })
        continue
      }

      if (branch && !existing.branches.some((b) => b.id === branch.id)) {
        existing.branches.push(branch)
      }
    }

    return Array.from(byUser.values()).map((entry) => ({
      ...entry,
      branches: entry.branches.sort((a, b) => a.label.localeCompare(b.label)),
    }))
  }, [moderatorsQuery.data])

  const rows = listQuery.data ?? []

  const handleOpenCreate = () => {
    setEditing(null)
    form.resetFields()
    setDrawerOpen(true)
  }

  const handleOpenEdit = (row: BranchEmailRecipientItem) => {
    setEditing(row)
    form.setFieldsValue({
      branchId: row.branchId,
      email: row.email,
      label: row.label ?? undefined,
      isActive: row.isActive,
    })
    setDrawerOpen(true)
  }

  return (
    <div className="space-y-4" data-tour-id="branch-email-recipients-page">
      {messageContextHolder}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Typography.Title level={3} className="!mb-0">
            Email primaoci po podružnicama
          </Typography.Title>
          <Typography.Text type="secondary">
            PDF zapisnik se automatski šalje moderatorima podružnice i dodatnim email primaocima.
          </Typography.Text>
        </div>
        <Button type="primary" onClick={handleOpenCreate}>
          Dodaj primaoca
        </Button>
      </div>

      <Space wrap>
        <Select
          allowClear
          style={{ width: 260 }}
          placeholder="Filter po podružnici"
          options={branchOptions}
          value={branchIdFilter}
          onChange={(v) => setBranchIdFilter(v || undefined)}
        />
        <Button onClick={() => setBranchIdFilter(undefined)}>Reset</Button>
      </Space>

      <div className="rounded-md border border-slate-200 p-3">
        <div className="font-medium mb-2">Moderatori podružnice (automatski primaoci)</div>
        {moderatorsQuery.isLoading ? (
          <div className="text-sm text-slate-500">Učitavanje…</div>
        ) : (moderatorsQuery.data ?? []).length === 0 ? (
          <div className="text-sm text-slate-500">Nema dodijeljenih moderatora.</div>
        ) : (
          <div className="space-y-2">
            {groupedModerators.map((m) => (
              <div key={m.key} className="text-sm">
                <div className="font-medium text-slate-900">{m.userLabel}</div>
                {m.branches.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {m.branches.map((b) => (
                      <Tag key={b.id} className="!m-0">
                        {b.label}
                      </Tag>
                    ))}
                  </div>
                ) : (
                  <div className="text-slate-500">–</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Table<BranchEmailRecipientItem>
        rowKey="id"
        loading={listQuery.isLoading}
        dataSource={rows}
        pagination={false}
        columns={[
          {
            title: 'Podružnica',
            render: (_, row) =>
              row.branch ? `${row.branch.name} (${row.branch.code})` : row.branchId,
          },
          { title: 'Email', dataIndex: 'email' },
          { title: 'Label', dataIndex: 'label', render: (v: string | null) => v ?? '–' },
          {
            title: 'Aktivan',
            dataIndex: 'isActive',
            width: 120,
            render: (_: unknown, row) => (
              <Switch
                checked={row.isActive}
                onChange={(checked) => updateMutation.mutate({ id: row.id, data: { isActive: checked } })}
                loading={updateMutation.isPending}
              />
            ),
          },
          {
            title: 'Akcije',
            width: 200,
            render: (_: unknown, row) => (
              <Space>
                <Button size="small" onClick={() => handleOpenEdit(row)}>
                  Uredi
                </Button>
                <Button danger size="small" onClick={() => removeMutation.mutate(row.id)} loading={removeMutation.isPending}>
                  Obriši
                </Button>
              </Space>
            ),
          },
        ]}
      />

      <Drawer
        title={editing ? 'Uredi primaoca' : 'Novi primalac'}
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
              branchId: values.branchId,
              email: values.email.trim(),
              label: values.label?.trim() || undefined,
            }
            if (editing) {
              updateMutation.mutate({ id: editing.id, data: { ...payload, isActive: values.isActive } })
              return
            }
            createMutation.mutate(payload)
          }}
          initialValues={{ isActive: true }}
        >
          <Form.Item name="branchId" label="Podružnica" rules={[{ required: true }]}>
            <Select
              placeholder="Odaberi podružnicu"
              options={branchOptions}
              loading={branchesQuery.isLoading}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true }, { type: 'email' }]}>
            <Input placeholder="email@example.com" />
          </Form.Item>
          <Form.Item name="label" label="Label (opciono)">
            <Input placeholder="npr. Podrška" />
          </Form.Item>
          {editing && (
            <Form.Item name="isActive" label="Aktivan" valuePropName="checked">
              <Switch />
            </Form.Item>
          )}
        </Form>
      </Drawer>
    </div>
  )
}

