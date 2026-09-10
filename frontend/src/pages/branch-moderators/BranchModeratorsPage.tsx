import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Drawer, Form, Select, Space, Table, Typography, message } from 'antd'
import { useMemo, useState } from 'react'
import { branchModeratorsApi } from '@/api/branch-moderators.api'
import { branchesApi } from '@/api/branches.api'
import { usersApi } from '@/api/users.api'
import { useAuthStore } from '@/store/auth.store'
import type { BranchModeratorItem } from '@/types/branch-moderator.types'
import { useTranslation } from '@/i18n'

export default function BranchModeratorsPage() {
  const queryClient = useQueryClient()
  const { t } = useTranslation();
  const [messageApi, messageContextHolder] = message.useMessage()
  const userDistributionId = useAuthStore((s) => s.user?.distributionId)

  const [branchIdFilter, setBranchIdFilter] = useState<string | undefined>(undefined)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [form] = Form.useForm<{ branchId: string; userId: string }>()

  const listQuery = useQuery({
    queryKey: ['branch-moderators', 'list', branchIdFilter],
    queryFn: () => branchModeratorsApi.list(branchIdFilter ? { branchId: branchIdFilter } : undefined),
  })

  const branchesQuery = useQuery({
    queryKey: ['branches', 'list', userDistributionId],
    queryFn: () => branchesApi.list(userDistributionId ?? undefined),
  })

  const usersQuery = useQuery({
    queryKey: ['users', 'list', 'for-branch-moderators'],
    queryFn: () => usersApi.list({ role: 'USER', limit: 200 }),
    enabled: drawerOpen,
  })

  const assignMutation = useMutation({
    mutationFn: (values: { branchId: string; userId: string }) => branchModeratorsApi.assign(values),
    onSuccess: async () => {
      messageApi.success(t('branchModerators.assignSuccess'))
      setDrawerOpen(false)
      form.resetFields()
      await queryClient.invalidateQueries({ queryKey: ['branch-moderators'] })
    },
    onError: (e: unknown) => {
      messageApi.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('common.states.error'),
      )
    },
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => branchModeratorsApi.remove(id),
    onSuccess: async () => {
      messageApi.success(t('branchModerators.removeSuccess'))
      await queryClient.invalidateQueries({ queryKey: ['branch-moderators'] })
    },
    onError: (e: unknown) => {
      messageApi.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('common.states.error'),
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

  const userOptions = useMemo(
    () =>
      (usersQuery.data?.items ?? []).map((u) => ({
        label: `${u.firstName} ${u.lastName} (${u.email})`,
        value: u.id,
      })),
    [usersQuery.data?.items],
  )

  const rows = listQuery.data ?? []

  return (
    <div className="space-y-4">
      {messageContextHolder}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Typography.Title level={3} className="!mb-0">
            {t('branchModerators.title')}
          </Typography.Title>
          <Typography.Text type="secondary">
            {t('branchModerators.subtitle')}
          </Typography.Text>
        </div>
        <Button type="primary" onClick={() => setDrawerOpen(true)}>
          {t('branchModerators.assignButton')}
        </Button>
      </div>

      <Space wrap>
        <Select
          allowClear
          style={{ width: 260 }}
          placeholder={t('branchModerators.filterPlaceholder')}
          options={branchOptions}
          value={branchIdFilter}
          onChange={(v) => setBranchIdFilter(v || undefined)}
        />
        <Button onClick={() => setBranchIdFilter(undefined)}>{t('common.actions.reset')}</Button>
      </Space>

      <Table<BranchModeratorItem>
        rowKey="id"
        loading={listQuery.isLoading}
        dataSource={rows}
        pagination={false}
        columns={[
          {
            title: t('common.labels.branch'),
            render: (_, row) =>
              row.branch ? `${row.branch.name} (${row.branch.code})` : row.branchId,
          },
          {
            title: t('common.labels.username'),
            render: (_, row) =>
              row.user ? `${row.user.firstName} ${row.user.lastName}` : row.userId,
          },
          {
            title: t('common.labels.email'),
            render: (_, row) => row.user?.email ?? '–',
          },
          {
            title: t('common.actions.actions'),
            width: 140,
            render: (_, row) => (
              <Button danger size="small" loading={removeMutation.isPending} onClick={() => removeMutation.mutate(row.id)}>
                {t('common.actions.remove')}
              </Button>
            ),
          },
        ]}
      />

      <Drawer
        title={t('branchModerators.drawerTitle')}
        open={drawerOpen}
        width={520}
        onClose={() => {
          setDrawerOpen(false)
          form.resetFields()
        }}
        destroyOnClose
        footer={
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                setDrawerOpen(false)
                form.resetFields()
              }}
            >
              {t('common.actions.cancel')}
            </Button>
            <Button type="primary" loading={assignMutation.isPending} onClick={() => form.submit()}>
              {t('common.actions.add')}
            </Button>
          </div>
        }
      >
        <Form form={form} layout="vertical" onFinish={(values) => assignMutation.mutate(values)}>
          <Form.Item name="branchId" label={t('common.labels.branch')} rules={[{ required: true }]}>
            <Select
              placeholder={t('branchModerators.selectBranchPlaceholder')}
              options={branchOptions}
              loading={branchesQuery.isLoading}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item name="userId" label={t('branchModerators.userFieldLabel')} rules={[{ required: true }]}>
            <Select
              placeholder={t('shipments.list.selectUserPlaceholder')}
              options={userOptions}
              loading={usersQuery.isLoading}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  )
}
