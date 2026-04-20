import { useQuery } from '@tanstack/react-query';
import { Button, Card, Descriptions, Space, Tag, Timeline, Typography } from 'antd';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { simCardsApi } from '@/api/sim-cards.api';
import {
  getDemountResolutionLabel,
  getMeterDemountCategoryLabel,
  getRemovedSimDispositionLabel,
  getSimCardStatusLabel,
  getSimEventTypeLabel,
} from '@/utils/labels.utils';

const statusColor: Record<string, string> = {
  AVAILABLE: 'green',
  ASSIGNED: 'orange',
  INSTALLED: 'blue',
  DEFECTIVE: 'red',
  DEMOUNTED: 'purple',
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

  const eventsQuery = useQuery({
    queryKey: ['sim-cards', 'details', id, 'events'],
    queryFn: () => simCardsApi.listEvents(id!),
    enabled: Boolean(id),
  });

  const simCard = simCardQuery.data;

  const renderMetadata = (metadata: unknown) => {
    if (!metadata || typeof metadata !== 'object') return null
    const m = metadata as Record<string, unknown>
    const meterId = typeof m.meterId === 'string' ? m.meterId : null
    const recordId = typeof m.recordId === 'string' ? m.recordId : null
    const demountTaskId = typeof m.demountTaskId === 'string' ? m.demountTaskId : null
    const resolution = typeof m.resolution === 'string' ? m.resolution : null
    const meterDemountCategory =
      typeof m.meterDemountCategory === 'string' ? m.meterDemountCategory : null
    const removedSimDisposition =
      typeof m.removedSimDisposition === 'string' ? m.removedSimDisposition : null

    const tags: Array<{ key: string; color?: string; label: string }> = []
    if (resolution)
      tags.push({
        key: 'resolution',
        color: 'blue',
        label: getDemountResolutionLabel(resolution),
      })
    if (removedSimDisposition)
      tags.push({
        key: 'removedSimDisposition',
        color: 'geekblue',
        label: getRemovedSimDispositionLabel(removedSimDisposition),
      })
    if (meterDemountCategory)
      tags.push({
        key: 'meterDemountCategory',
        color: 'gold',
        label: getMeterDemountCategoryLabel(meterDemountCategory),
      })

    const hasAny = Boolean(meterId) || Boolean(recordId) || Boolean(demountTaskId) || tags.length > 0
    if (!hasAny) return null

    return (
      <div className="mt-2 flex flex-col gap-2">
        {tags.length > 0 ? (
          <Space size={[6, 6]} wrap>
            {tags.map((t) => (
              <Tag key={t.key} color={t.color}>
                {t.label}
              </Tag>
            ))}
          </Space>
        ) : null}
        <Space size={[10, 8]} wrap>
          {meterId ? (
            <Typography.Text type="secondary" className="text-xs">
              Brojilo: <Link to={`/meters/${meterId}`}>Otvori</Link>
            </Typography.Text>
          ) : null}
          {recordId ? (
            <Typography.Text type="secondary" className="text-xs">
              Zapisnik: <Link to={`/installation-records/${recordId}`}>{recordId.slice(0, 8)}…</Link>
            </Typography.Text>
          ) : null}
          {demountTaskId ? (
            <Typography.Text type="secondary" className="text-xs">
              Task: <Typography.Text code copyable={{ text: demountTaskId }}>{demountTaskId.slice(0, 8)}…</Typography.Text>
            </Typography.Text>
          ) : null}
        </Space>
      </div>
    )
  }

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
              <Tag color={statusColor[simCard.status] ?? 'default'}>
                {getSimCardStatusLabel(simCard.status)}
              </Tag>
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

      <Card title="Kretanje / historija događaja" loading={eventsQuery.isLoading}>
        {eventsQuery.data && eventsQuery.data.length === 0 ? (
          <Typography.Text type="secondary">Nema zabilježenih događaja.</Typography.Text>
        ) : null}
        {eventsQuery.data && eventsQuery.data.length > 0 ? (
          <Timeline
            items={eventsQuery.data.map((ev) => ({
              key: ev.id,
              children: (
                <div>
                  <Typography.Text strong>{getSimEventTypeLabel(ev.type)}</Typography.Text>
                  <div className="text-slate-500 text-sm">
                    {new Date(ev.createdAt).toLocaleString('bs-BA')}
                    {ev.user
                      ? ` · ${ev.user.firstName} ${ev.user.lastName}`
                      : ''}
                  </div>
                  {renderMetadata(ev.metadata) ?? (
                    <Typography.Text type="secondary" className="text-xs">
                      Nema dodatnih detalja.
                    </Typography.Text>
                  )}
                </div>
              ),
            }))}
          />
        ) : null}
      </Card>
    </Space>
  );
}
