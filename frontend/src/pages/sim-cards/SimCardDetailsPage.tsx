import { useQuery } from '@tanstack/react-query';
import { Button, Card, Descriptions, Space, Tag, Typography } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { simCardsApi } from '@/api/sim-cards.api';

const statusColor: Record<string, string> = {
  AVAILABLE: 'green',
  ASSIGNED: 'orange',
  INSTALLED: 'blue',
  DEFECTIVE: 'red',
  RETURNED: 'gold',
  DEACTIVATED: 'default',
};

export default function SimCardDetailsPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const simCardQuery = useQuery({
    queryKey: ['sim-cards', 'details', id],
    queryFn: () => simCardsApi.getById(id!),
    enabled: Boolean(id),
  });

  const simCard = simCardQuery.data;

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Space>
        <Button onClick={() => navigate('/shipments')}>Nazad</Button>
        <Typography.Title level={3} className="!mb-0">
          Detalji SIM kartice
        </Typography.Title>
      </Space>

      <Card loading={simCardQuery.isLoading}>
        {simCard ? (
          <Descriptions column={2} bordered>
            <Descriptions.Item label="ICCID">{simCard.iccid}</Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={statusColor[simCard.status] ?? 'default'}>{simCard.status}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="IP adresa">{simCard.ipAddress}</Descriptions.Item>
            <Descriptions.Item label="Javna IP">
              {simCard.publicIpAddress ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Telefon">{simCard.phoneNumber ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="APN">{simCard.apn ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="Isporuka">
              {simCard.shipment.name} ({simCard.shipment.provider})
            </Descriptions.Item>
            <Descriptions.Item label="Dodijeljena korisniku">
              {simCard.assignedTo
                ? `${simCard.assignedTo.firstName} ${simCard.assignedTo.lastName}`
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Dodijeljena u">
              {simCard.assignedAt ? new Date(simCard.assignedAt).toLocaleString() : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Kreirano">
              {new Date(simCard.createdAt).toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="Ažurirano">
              {new Date(simCard.updatedAt).toLocaleString()}
            </Descriptions.Item>
          </Descriptions>
        ) : null}
      </Card>
    </Space>
  );
}
