import { useQuery } from '@tanstack/react-query';
import { Button, Select, Space, Table, Tag, Typography, Tour } from 'antd';
import type { TourProps } from 'antd';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { installationRecordsApi } from '@/api/installation-records.api';
import { getApiErrorMessage } from '@/utils/error.utils';
import type {
  InstallationRecordItem,
  InstallationRecordsListParams,
  RecordStatus,
} from '@/types/installation-record.types';

const statusFilterOptions = [
  { label: 'Svi statusi', value: '' },
  { label: 'Nacrt', value: 'DRAFT' },
  { label: 'Čeka odobrenje', value: 'PENDING' },
  { label: 'Greška slanja', value: 'SUBMIT_FAILED' },
  { label: 'Odbijeno', value: 'REJECTED' },
  { label: 'Čeka SEP', value: 'WAITING_SEP_ACTIVATION' },
  { label: 'Aktivirano u SEP', value: 'ACTIVATED_IN_SEP' },
  { label: 'Poslano', value: 'SENT' },
];

const statusColor: Record<string, string> = {
  DRAFT: 'default',
  PENDING: 'processing',
  SUBMIT_FAILED: 'error',
  REJECTED: 'error',
  WAITING_SEP_ACTIVATION: 'warning',
  ACTIVATED_IN_SEP: 'success',
  SENT: 'blue',
};

const statusLabel: Record<string, string> = {
  DRAFT: 'Nacrt',
  PENDING: 'Čeka odobrenje',
  SUBMIT_FAILED: 'Greška slanja',
  REJECTED: 'Odbijeno',
  WAITING_SEP_ACTIVATION: 'Čeka SEP',
  ACTIVATED_IN_SEP: 'Aktivirano u SEP',
  SENT: 'Poslano',
};

const defaultFilters: InstallationRecordsListParams = {
  page: 1,
  limit: 20,
};

export default function InstallationRecordsListPage() {
  const navigate = useNavigate();
  const [filters, setFilters] =
    useState<InstallationRecordsListParams>(defaultFilters);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const seen = window.localStorage.getItem('sim-tracker-page-tour-records-v1');
    const globalActive = window.localStorage.getItem('sim-tracker-global-tour-active') === '1';
    if (!seen && !globalActive) {
      setTourOpen(true);
    }
  }, []);

  const listQuery = useQuery({
    queryKey: ['installation-records', 'list', filters],
    queryFn: () =>
      installationRecordsApi.list({
        page: filters.page,
        limit: filters.limit,
        status: filters.status,
      }),
  });

  const rows = listQuery.data?.items ?? [];

  return (
    <div
      className="space-y-4"
      data-tour-id="admin-records"
      data-tour-role="SYSTEM_ADMIN MODERATOR"
    >
      <div
        className="flex flex-wrap items-center justify-between gap-4"
        data-tour-id="records-header"
      >
        <Typography.Title level={3} className="!mb-0">
          Zapisnici ugradnje
        </Typography.Title>
        <Button type="primary" onClick={() => navigate('/installation-records/new')}>
          Novi zapisnik
        </Button>
      </div>

      <Space
        wrap
        data-tour-id="records-filters"
      >
        <Select
          placeholder="Status"
          allowClear
          style={{ width: 180 }}
          value={filters.status ?? ''}
          onChange={(value) =>
            setFilters((prev) => ({
              ...prev,
              page: 1,
              status: (value as RecordStatus) || undefined,
            }))
          }
          options={statusFilterOptions}
        />
        <Button
          onClick={() => setFilters(defaultFilters)}
        >
          Reset filtera
        </Button>
      </Space>

      {listQuery.isError && (
        <Typography.Text type="danger">
          {getApiErrorMessage(listQuery.error, 'Učitavanje liste nije uspjelo.')}
        </Typography.Text>
      )}

      <Table<InstallationRecordItem>
        rowKey="id"
        loading={listQuery.isLoading}
        dataSource={rows}
        pagination={{
          current: listQuery.data?.page,
          pageSize: listQuery.data?.limit,
          total: listQuery.data?.total,
          showSizeChanger: true,
          showTotal: (total) => `Ukupno: ${total}`,
          onChange: (page, pageSize) =>
            setFilters((prev) => ({ ...prev, page, limit: pageSize ?? 20 })),
        }}
        columns={[
          {
            title: 'Broj zapisnika',
            dataIndex: 'recordNumber',
            key: 'recordNumber',
            render: (_, row) => (
              <Button
                type="link"
                className="p-0"
                onClick={() => navigate(`/installation-records/${row.id}`)}
              >
                {row.recordNumber}
              </Button>
            ),
          },
          {
            title: 'ICCID',
            key: 'iccid',
            render: (_, row) => row.meter?.simCard?.iccid ?? '–',
          },
          {
            title: 'Brojilo',
            key: 'meter',
            render: (_, row) =>
              row.meter
                ? `${row.meter.serialNumber}${row.meter.meterTypeDefinition ? ` (${row.meter.meterTypeDefinition.name})` : ''}`
                : '–',
          },
          {
            title: 'Adresa / Lokacija',
            key: 'address',
            ellipsis: true,
            render: (_, row) =>
              row.meter?.installationAddress ||
              [row.meter?.city, row.meter?.municipality].filter(Boolean).join(', ') ||
              '–',
          },
          {
            title: 'Datum ugradnje',
            key: 'installationDate',
            render: (_, row) =>
              row.meter?.installationDate
                ? new Date(row.meter.installationDate).toLocaleDateString()
                : '–',
          },
          {
            title: 'Instalirao',
            key: 'installedBy',
            render: (_, row) =>
              row.installedBy
                ? `${row.installedBy.firstName} ${row.installedBy.lastName}`
                : '–',
          },
          {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status: RecordStatus) => (
              <Tag color={statusColor[status] ?? 'default'}>
                {statusLabel[status] ?? status}
              </Tag>
            ),
          },
        ]}
      />
      <Tour
        open={tourOpen}
        current={tourStep}
        onClose={() => {
          setTourOpen(false);
          if (typeof window !== 'undefined') {
            window.localStorage.setItem('sim-tracker-page-tour-records-v1', '1');
          }
        }}
        onChange={(next) => setTourStep(next)}
        steps={
          [
            {
              title: 'Pregled zapisnika',
              description:
                'Ovdje vidiš sve zapisnike ugradnje sa ključnim informacijama i statusom.',
              target: () =>
                document.querySelector('[data-tour-id="records-header"]') as HTMLElement,
            },
            {
              title: 'Filter po statusu',
              description:
                'Filter statusa omogućava fokus na zapisnike koji su u određenom koraku lifecycle-a (npr. Čeka odobrenje).',
              target: () =>
                document.querySelector('[data-tour-id="records-filters"]') as HTMLElement,
            },
            {
              title: 'Tabela zapisnika',
              description:
                'Klikom na broj zapisnika otvaraš detalje, PDF i radnje odobravanja u skladu sa svojom ulogom.',
              target: () =>
                document.querySelector('[data-tour-id="admin-records"] table') as HTMLElement,
            },
          ].filter((step) => {
            try {
              return Boolean(step.target && step.target());
            } catch {
              return false;
            }
          }) as TourProps['steps']
        }
      />
    </div>
  );
}
