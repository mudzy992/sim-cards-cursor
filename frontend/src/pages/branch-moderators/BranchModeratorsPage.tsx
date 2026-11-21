import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Drawer, Form, Select, Table, message } from 'antd'
import { useMemo, useState } from 'react'
import { branchModeratorsApi } from '@/api/branch-moderators.api'
import { branchesApi } from '@/api/branches.api'
import { usersApi } from '@/api/users.api'
import { useAuthStore } from '@/store/auth.store'
import type { BranchModeratorItem } from '@/types/branch-moderator.types'
import { useTranslation } from '@/i18n'
import { EmptyNotice, FilterBar, PageHeader, PageShell } from '@/components/ui'
import { getApiErrorMessage } from '@/utils/error.utils'

export default function BranchModeratorsPage() {
  const queryClient = useQueryClient()
  const { t } = useTranslation();
  const [messageApi, messageContextHolder] = message.useMessage()
  const userDistributionId = useAuthStore((s) => s.user?.distributionId)

  const [branchIdFilter, setBranchIdFilter] = useState<string | undefined>(undefined)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [userSearch, setUserSearch] = useState('')
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
    queryKey: ['users', 'list', 'for-branch-moderators', userSearch],
    queryFn: () =>
      usersApi.list({
        role: 'USER',
        limit: 100,
        ...(userSearch.trim() ? { search: userSearch.trim() } : {}),
      }),
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
      messageApi.error(getApiErrorMessage(e, t('common.states.error')))
    },
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => branchModeratorsApi.remove(id),
    onSuccess: async () => {
      messageApi.success(t('branchModerators.removeSuccess'))
      await queryClient.invalidateQueries({ queryKey: ['branch-moderators'] })
    },
    onError: (e: unknown) => {
      messageApi.error(getApiErrorMessage(e, t('common.states.error')))
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
    <PageShell>
      {messageContextHolder}
      <PageHeader
        title={t('branchModerators.title')}
        subtitle={t('branchModerators.subtitle')}
        actions={
          <Button type="primary" onClick={() => setDrawerOpen(true)}>
            {t('branchModerators.assignButton')}
          </Button>
        }
      />

      <FilterBar
        hasActiveFilters={Boolean(branchIdFilter)}
        onReset={() => setBranchIdFilter(undefined)}
      >
        <Select
          allowClear
          style={{ width: 260 }}
          placeholder={t('branchModerators.filterPlaceholder')}
          options={branchOptions}
          value={branchIdFilter}
          onChange={(v) => setBranchIdFilter(v || undefined)}
        />
      </FilterBar>

      <Table<BranchModeratorItem>
        rowKey="id"
        loading={listQuery.isLoading}
        dataSource={rows}
        locale={{ emptyText: <EmptyNotice /> }}
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
          setUserSearch('')
          form.resetFields()
        }}
        destroyOnClose
        footer={
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                setDrawerOpen(false)
                setUserSearch('')
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
              filterOption={false}
              onSearch={setUserSearch}
              onSelect={() => setUserSearch('')}
            />
          </Form.Item>
        </Form>
      </Drawer>
    </PageShell>
  )
}
