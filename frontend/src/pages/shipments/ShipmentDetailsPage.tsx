import { useQuery } from '@tanstack/react-query';
import { Button, Card, Descriptions, Space, Table, Tag, Typography } from 'antd';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { shipmentsApi } from '@/api/shipments.api';
import { getSimCardStatusLabel } from '@/utils/labels.utils'
import type { ShipmentSimCardsResponse } from '@/types/shipment.types';
type ShipmentSimCard = ShipmentSimCardsResponse['items'][number];

const statusColor: Record<string, string> = {
  RECEIVED: 'blue',
  PROCESSING: 'orange',
  COMPLETED: 'green',
};

const simStatusColor: Record<string, string> = {
  AVAILABLE: 'green',
  ASSIGNED: 'orange',
  INSTALLED: 'blue',
  DEFECTIVE: 'red',
  RETURNED: 'gold',
  DEACTIVATED: 'default',
};

export default function ShipmentDetailsPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
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
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Space>
        <Button onClick={() => navigate('/shipments')}>Nazad</Button>
        <Typography.Title level={3} className="!mb-0">
          Detalji isporuke
        </Typography.Title>
      </Space>

      <Card loading={shipmentQuery.isLoading}>
        {shipment ? (
          <Descriptions column={2} bordered>
            <Descriptions.Item label="Naziv">{shipment.name}</Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={statusColor[shipment.status] ?? 'default'}>{shipment.status}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Provajder">{shipment.provider}</Descriptions.Item>
            <Descriptions.Item label="Datum prijema">
              {new Date(shipment.receivedDate).toLocaleDateString()}
            </Descriptions.Item>
            <Descriptions.Item label="Ukupno kartica">{shipment.totalCards}</Descriptions.Item>
            <Descriptions.Item label="Importovao">
              {shipment.importedBy.firstName} {shipment.importedBy.lastName}
            </Descriptions.Item>
            <Descriptions.Item label="Napomena" span={2}>
              {shipment.notes ?? '-'}
            </Descriptions.Item>
          </Descriptions>
        ) : null}
      </Card>

      <Card title="SIM kartice iz ove isporuke" loading={shipmentCardsQuery.isLoading}>
        <Table<ShipmentSimCard>
          rowKey="id"
          dataSource={cards}
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
                <Button type="link" onClick={() => navigate(`/sim-cards/${row.id}`)}>
                  {row.iccid}
                </Button>
              ),
            },
            { title: 'IP', dataIndex: 'ipAddress' },
            {
              title: 'Javna IP',
              render: (_, row) => row.publicIpAddress ?? '-',
            },
            {
              title: 'Status',
              render: (_, row) => (
                <Tag color={simStatusColor[row.status] ?? 'default'}>
                  {getSimCardStatusLabel(row.status as any)}
                </Tag>
              ),
            },
            {
              title: 'Dodijeljena',
              render: (_, row) =>
                row.assignedTo
                  ? `${row.assignedTo.firstName} ${row.assignedTo.lastName}`
                  : '-',
            },
          ]}
        />
      </Card>
    </Space>
  );
}
