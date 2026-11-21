import { useQuery } from '@tanstack/react-query';
import { Button, Descriptions, Table } from 'antd';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { shipmentsApi } from '@/api/shipments.api';
import { getSimCardStatusLabel } from '@/utils/labels.utils';
import type { ShipmentSimCardsResponse } from '@/types/shipment.types';
import type { SimCardStatus } from '@/types/sim-card.types';
import { PrinterOutlined } from '@ant-design/icons';
import { useTranslation } from '@/i18n';
import {
  EmptyNotice,
  PageHeader,
  PageShell,
  SectionCard,
  StatusBadge,
  getShipmentStatusTone,
  getSimCardStatusTone,
} from '@/components/ui';
import { FALLBACK_DASH } from '@/constants/ui';
import { ROUTES } from '@/config/routes';
import { formatDate, formatNumber } from '@/utils/formatters';

type ShipmentSimCard = ShipmentSimCardsResponse['items'][number];

export default function ShipmentDetailsPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { t, language } = useTranslation();
  const [pagination, setPagination] = useState({ page: 1, limit: 100 });

  const shipmentQuery = useQuery({
    queryKey: ['shipments', 'details', id],
    queryFn: () => shipmentsApi.getById(id!),
    enabled: Boolean(id),
  });

  const shipmentCardsQuery = useQuery({
    queryKey: ['shipments', 'details', id, 'sim-cards', pagination],
    queryFn: () =>
      shipmentsApi.listSimCards(id!, { page: pagination.page, limit: pagination.limit }),
    enabled: Boolean(id),
  });

  const shipment = shipmentQuery.data;
  const cards = shipmentCardsQuery.data?.items ?? [];

  return (
    <PageShell>
      <PageHeader
        title={t('shipments.details.title')}
        backTo={ROUTES.shipments}
        badge={
          shipment ? (
            <StatusBadge
              tone={getShipmentStatusTone(shipment.status)}
              label={shipment.status}
            />
          ) : undefined
        }
        actions={
          id ? (
            <Button
              icon={<PrinterOutlined />}
              onClick={() => navigate(ROUTES.shipmentPrint(id))}
            >
              {t('shipments.details.printLabels')}
            </Button>
          ) : undefined
        }
      />

      <SectionCard loading={shipmentQuery.isLoading}>
        {shipment ? (
          <Descriptions column={{ xs: 1, sm: 2 }} bordered>
            <Descriptions.Item label={t('common.labels.name')}>{shipment.name}</Descriptions.Item>
            <Descriptions.Item label={t('common.labels.status')}>
              <StatusBadge
                tone={getShipmentStatusTone(shipment.status)}
                label={shipment.status}
              />
            </Descriptions.Item>
            <Descriptions.Item label={t('shipments.details.provider')}>
              {shipment.provider}
            </Descriptions.Item>
            <Descriptions.Item label={t('shipments.details.receivedDate')}>
              {formatDate(shipment.receivedDate, language)}
            </Descriptions.Item>
            <Descriptions.Item label={t('shipments.details.totalCards')}>
              {formatNumber(shipment.totalCards, language)}
            </Descriptions.Item>
            <Descriptions.Item label={t('shipments.details.importedBy')}>
              {shipment.importedBy.firstName} {shipment.importedBy.lastName}
            </Descriptions.Item>
            <Descriptions.Item label={t('common.labels.notes')} span={{ xs: 1, sm: 2 }}>
              {shipment.notes ?? FALLBACK_DASH}
            </Descriptions.Item>
          </Descriptions>
        ) : null}
      </SectionCard>

      <SectionCard
        title={t('shipments.details.cardsInShipment')}
        loading={shipmentCardsQuery.isLoading}
      >
        <Table<ShipmentSimCard>
          rowKey="id"
          dataSource={cards}
          locale={{ emptyText: <EmptyNotice /> }}
          pagination={{
            current: shipmentCardsQuery.data?.page,
            pageSize: shipmentCardsQuery.data?.limit,
            total: shipmentCardsQuery.data?.total,
            showSizeChanger: true,
            pageSizeOptions: ['20', '50', '100'],
            onChange: (page, pageSize) => {
              setPagination({ page, limit: Math.min(pageSize, 100) });
            },
          }}
          columns={[
            {
              title: 'ICCID',
              render: (_, row) => (
                <Button
                  type="link"
                  className="p-0 font-mono"
                  onClick={() => navigate(ROUTES.simCardDetail(row.id))}
                >
                  {row.iccid}
                </Button>
              ),
            },
            { title: 'IP', dataIndex: 'ipAddress' },
            {
              title: t('simCards.details.publicIp'),
              render: (_, row) => row.publicIpAddress ?? FALLBACK_DASH,
            },
            {
              title: t('common.labels.status'),
              render: (_, row) => (
                <StatusBadge
                  tone={getSimCardStatusTone(row.status)}
                  label={getSimCardStatusLabel(row.status as SimCardStatus, t)}
                />
              ),
            },
            {
              title: t('simCards.details.assignedTo'),
              render: (_, row) =>
                row.assignedTo
                  ? `${row.assignedTo.firstName} ${row.assignedTo.lastName}`
                  : FALLBACK_DASH,
            },
          ]}
        />
      </SectionCard>
    </PageShell>
  );
}
