import { useQuery } from '@tanstack/react-query'
import { Button, Input, Space, Table, Tag, Typography } from 'antd'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { simCardsApi } from '@/api/sim-cards.api'
import type { ModeratedInstalledSimCardItem, SimCardListParams, SimCardStatus } from '@/types/sim-card.types'
import { getSimCardStatusLabel } from '@/utils/labels.utils'
import { useTranslation } from '@/i18n'

const simStatusColor: Record<string, string> = {
  AVAILABLE: 'green',
  ASSIGNED: 'orange',
  INSTALLED: 'blue',
  DEFECTIVE: 'red',
  DEMOUNTED: 'purple',
  RETURNED: 'gold',
  DEACTIVATED: 'default',
}

export default function ModeratedInstalledSimCardsPage() {
  const navigate = useNavigate()
  const { t, language } = useTranslation();
  const dateLocale = language === 'bs' ? 'bs-BA' : 'en-US';
  const [filters, setFilters] = useState<SimCardListParams>({ page: 1, limit: 20 })
  const [searchInput, setSearchInput] = useState('')

  const query = useQuery({
    queryKey: ['sim-cards', 'moderated-installed', filters],
    queryFn: () => simCardsApi.moderatedInstalled(filters),
  })

  const rows = query.data?.items ?? []

  const handleReset = () => {
    setSearchInput('')
    setFilters({ page: 1, limit: 20 })
  }

  const columns = useMemo(
    () => [
      {
        title: 'ICCID',
        key: 'iccid',
        render: (_: unknown, row: ModeratedInstalledSimCardItem) => (
          <Button type="link" onClick={() => navigate(`/sim-cards/${row.id}`)} className="p-0">
            {row.iccid}
          </Button>
        ),
      },
      { title: 'IP', dataIndex: 'ipAddress', key: 'ipAddress' },
      {
        title: t('simCards.list.columns.branch'),
        key: 'branch',
        render: (_: unknown, row: ModeratedInstalledSimCardItem) => {
          const b = row.meter?.branch
          if (!b) return '–'
          return `${b.name} (${b.code})`
        },
      },
      {
        title: t('layout.sidebar.meters'),
        key: 'meterSerial',
        render: (_: unknown, row: ModeratedInstalledSimCardItem) => row.meter?.serialNumber ?? '–',
      },
      {
        title: t('simCards.details.assignedTo'),
        key: 'assignedTo',
        render: (_: unknown, row: ModeratedInstalledSimCardItem) =>
          row.assignedTo ? `${row.assignedTo.firstName} ${row.assignedTo.lastName}` : '–',
      },
      {
        title: t('simCards.list.columns.installedAt'),
        key: 'installedAt',
        width: 180,
        render: (_: unknown, row: ModeratedInstalledSimCardItem) =>
          row.installedAt ? new Date(row.installedAt).toLocaleString(dateLocale) : '–',
      },
      {
        title: t('common.labels.status'),
        key: 'status',
        width: 150,
        render: (_: unknown, row: ModeratedInstalledSimCardItem) => (
          <Tag color={simStatusColor[row.status] ?? 'default'}>
            {getSimCardStatusLabel(row.status as SimCardStatus, t)}
          </Tag>
        ),
      },
    ],
    [navigate, t, dateLocale],
  )

  return (
    <div className="space-y-4" data-tour-id="moderator-installed-sims">
      <Typography.Title level={3} className="!mb-0">
        {t('simCards.list.titleInstalled')}
      </Typography.Title>
      <Typography.Text type="secondary">
        {t('simCards.list.subtitleInstalled')}
      </Typography.Text>

      <Space wrap>
        <Input.Search
          allowClear
          placeholder={t('simCards.list.searchPlaceholder')}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onSearch={(value) =>
            setFilters((prev) => ({
              ...prev,
              page: 1,
              search: value.trim() || undefined,
            }))
          }
          style={{ width: 280 }}
        />
        <Button onClick={handleReset} disabled={!filters.search}>
          {t('common.actions.reset')}
        </Button>
      </Space>

      {query.isError && (
        <Typography.Text type="danger">
          {(query.error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
            t('simCards.list.loadFailed')}
        </Typography.Text>
      )}

      <div className="-mx-4 overflow-x-auto px-4">
        <Table<ModeratedInstalledSimCardItem>
          rowKey="id"
          loading={query.isLoading}
          dataSource={rows}
          pagination={{
            current: query.data?.page,
            pageSize: query.data?.limit,
            total: query.data?.total,
            showSizeChanger: true,
            showTotal: (total) => t('common.pagination.totalItems', { count: total }),
            onChange: (page, pageSize) =>
              setFilters((prev) => ({ ...prev, page, limit: pageSize ?? 20 })),
          }}
          columns={columns}
          scroll={{ x: 'max-content' }}
        />
      </div>
    </div>
  )
}
