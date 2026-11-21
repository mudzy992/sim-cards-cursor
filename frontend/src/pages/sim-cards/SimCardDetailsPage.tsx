import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Descriptions, Popconfirm, Space, Timeline, Typography, message } from 'antd';
import { Link, useParams } from 'react-router-dom';
import { simCardsApi } from '@/api/sim-cards.api';
import { useAuthStore } from '@/store/auth.store';
import {
  getDemountResolutionLabel,
  getMeterDemountCategoryLabel,
  getRemovedSimDispositionLabel,
  getSimCardStatusLabel,
  getSimEventTypeLabel,
} from '@/utils/labels.utils';
import { useTranslation } from '@/i18n';
import {
  EmptyNotice,
  PageHeader,
  PageShell,
  SectionCard,
  StatusBadge,
  type StatusTone,
  getSimCardStatusTone,
} from '@/components/ui';
import { FALLBACK_DASH } from '@/constants/ui';
import { ROUTES } from '@/config/routes';
import { formatDateTime } from '@/utils/formatters';

export default function SimCardDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const role = user?.role;
  const isModerator = role === 'USER' && (user?.branchModeratorBranchIds?.length ?? 0) > 0;
  const canManage = role === 'SYSTEM_ADMIN' || role === 'DIST_ADMIN';
  const { t, language } = useTranslation();
  const queryClient = useQueryClient();
  const [messageApi, messageContextHolder] = message.useMessage();

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

  const returnToStockMutation = useMutation({
    mutationFn: () => simCardsApi.returnToStock(id!),
    onSuccess: async () => {
      messageApi.success(t('simCards.details.returnToStockSuccess'));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['sim-cards', 'details', id] }),
        queryClient.invalidateQueries({ queryKey: ['sim-cards', 'list'] }),
        queryClient.invalidateQueries({ queryKey: ['shipments', 'list'] }),
      ]);
    },
    onError: () => {
      messageApi.error(t('common.states.error'));
    },
  });

  const simCard = simCardQuery.data;
  const canReturnToStock =
    canManage &&
    Boolean(simCard) &&
    !simCard?.meter &&
    (simCard?.status === 'DEMOUNTED' || simCard?.status === 'RETURNED');

  const renderMetadata = (metadata: unknown) => {
    if (!metadata || typeof metadata !== 'object') return null;
    const m = metadata as Record<string, unknown>;
    const meterId = typeof m.meterId === 'string' ? m.meterId : null;
    const recordId = typeof m.recordId === 'string' ? m.recordId : null;
    const demountTaskId = typeof m.demountTaskId === 'string' ? m.demountTaskId : null;
    const resolution = typeof m.resolution === 'string' ? m.resolution : null;
    const meterDemountCategory =
      typeof m.meterDemountCategory === 'string' ? m.meterDemountCategory : null;
    const removedSimDisposition =
      typeof m.removedSimDisposition === 'string' ? m.removedSimDisposition : null;

    const tags: Array<{ key: string; tone: StatusTone; label: string }> = [];
    if (resolution) {
      tags.push({
        key: 'resolution',
        tone: 'info',
        label: getDemountResolutionLabel(resolution, t),
      });
    }
    if (removedSimDisposition) {
      tags.push({
        key: 'removedSimDisposition',
        tone: 'accent',
        label: getRemovedSimDispositionLabel(removedSimDisposition, t),
      });
    }
    if (meterDemountCategory) {
      tags.push({
        key: 'meterDemountCategory',
        tone: 'warning',
        label: getMeterDemountCategoryLabel(meterDemountCategory, t),
      });
    }

    const hasAny =
      Boolean(meterId) || Boolean(recordId) || Boolean(demountTaskId) || tags.length > 0;
    if (!hasAny) return null;

    return (
      <div className="mt-2 flex flex-col gap-2">
        {tags.length > 0 ? (
          <Space size={[6, 6]} wrap>
            {tags.map((tag) => (
              <StatusBadge key={tag.key} tone={tag.tone} label={tag.label} />
            ))}
          </Space>
        ) : null}
        <Space size={[10, 8]} wrap>
          {meterId ? (
            <span className="text-xs text-fg-secondary">
              {t('simCards.details.meter')}:{' '}
              <Link to={ROUTES.meterDetail(meterId)} className="text-accent-fg hover:underline">
                {t('common.actions.view')}
              </Link>
            </span>
          ) : null}
          {recordId ? (
            <span className="text-xs text-fg-secondary">
              {t('simCards.details.record')}:{' '}
              <Link
                to={ROUTES.installationRecordDetail(recordId)}
                className="font-mono text-accent-fg hover:underline"
              >
                {recordId.slice(0, 8)}…
              </Link>
            </span>
          ) : null}
          {demountTaskId ? (
            <span className="text-xs text-fg-secondary">
              {t('simCards.details.task')}:{' '}
              <Typography.Text code copyable={{ text: demountTaskId }}>
                {demountTaskId.slice(0, 8)}…
              </Typography.Text>
            </span>
          ) : null}
        </Space>
      </div>
    );
  };

  return (
    <PageShell>
      {messageContextHolder}
      <PageHeader
        title={t('simCards.details.title')}
        backTo={isModerator ? ROUTES.simCards : ROUTES.shipments}
        badge={
          simCard ? (
            <StatusBadge
              tone={getSimCardStatusTone(simCard.status)}
              label={getSimCardStatusLabel(simCard.status, t)}
            />
          ) : undefined
        }
        actions={
          canReturnToStock ? (
            <Popconfirm
              title={t('simCards.details.returnToStockConfirm')}
              onConfirm={() => returnToStockMutation.mutate()}
              okText={t('common.actions.confirm')}
              cancelText={t('common.actions.cancel')}
            >
              <Button type="primary" loading={returnToStockMutation.isPending}>
                {t('simCards.details.returnToStock')}
              </Button>
            </Popconfirm>
          ) : undefined
        }
      />

      <SectionCard loading={simCardQuery.isLoading}>
        {simCard ? (
          <Descriptions column={{ xs: 1, sm: 2 }} bordered>
            <Descriptions.Item label="ICCID">
              <span className="font-mono">{simCard.iccid}</span>
            </Descriptions.Item>
            <Descriptions.Item label={t('common.labels.status')}>
              <StatusBadge
                tone={getSimCardStatusTone(simCard.status)}
                label={getSimCardStatusLabel(simCard.status, t)}
              />
            </Descriptions.Item>
            <Descriptions.Item label={t('simCards.details.ipAddress')}>
              <span className="font-mono">{simCard.ipAddress}</span>
            </Descriptions.Item>
            <Descriptions.Item label={t('simCards.details.publicIp')}>
              <span className="font-mono">{simCard.publicIpAddress ?? FALLBACK_DASH}</span>
            </Descriptions.Item>
            <Descriptions.Item label={t('common.labels.phone')}>
              {simCard.phoneNumber ?? FALLBACK_DASH}
            </Descriptions.Item>
            <Descriptions.Item label="APN">{simCard.apn ?? FALLBACK_DASH}</Descriptions.Item>
            <Descriptions.Item label={t('simCards.details.shipment')}>
              {simCard.shipment.name} ({simCard.shipment.provider})
            </Descriptions.Item>
            <Descriptions.Item label={t('simCards.details.meter')}>
              {simCard.meter ? (
                <Space size={8} wrap>
                  <Link
                    to={ROUTES.meterDetail(simCard.meter.id)}
                    className="font-mono text-accent-fg hover:underline"
                  >
                    {simCard.meter.serialNumber}
                  </Link>
                  {simCard.meter.branch ? (
                    <span className="text-xs text-fg-secondary">
                      ({simCard.meter.branch.name})
                    </span>
                  ) : null}
                </Space>
              ) : (
                FALLBACK_DASH
              )}
            </Descriptions.Item>
            <Descriptions.Item label={t('simCards.details.assignedTo')}>
              {simCard.assignedTo
                ? `${simCard.assignedTo.firstName} ${simCard.assignedTo.lastName}`
                : FALLBACK_DASH}
            </Descriptions.Item>
            <Descriptions.Item label={t('simCards.details.assignedAt')}>
              {formatDateTime(simCard.assignedAt, language)}
            </Descriptions.Item>
            <Descriptions.Item label={t('common.labels.createdAt')}>
              {formatDateTime(simCard.createdAt, language)}
            </Descriptions.Item>
            <Descriptions.Item label={t('common.labels.updatedAt')}>
              {formatDateTime(simCard.updatedAt, language)}
            </Descriptions.Item>
          </Descriptions>
        ) : null}
      </SectionCard>

      <SectionCard title={t('simCards.details.historyTitle')} loading={eventsQuery.isLoading}>
        {eventsQuery.data && eventsQuery.data.length === 0 ? (
          <EmptyNotice title={t('simCards.details.noEvents')} />
        ) : null}
        {eventsQuery.data && eventsQuery.data.length > 0 ? (
          <Timeline
            items={eventsQuery.data.map((ev) => ({
              key: ev.id,
              children: (
                <div>
                  <div className="font-semibold text-fg-primary">
                    {getSimEventTypeLabel(ev.type, t)}
                  </div>
                  <div className="text-sm text-fg-secondary">
                    {formatDateTime(ev.createdAt, language)}
                    {ev.user ? ` · ${ev.user.firstName} ${ev.user.lastName}` : ''}
                  </div>
                  {renderMetadata(ev.metadata) ?? (
                    <span className="text-xs text-fg-muted">
                      {t('simCards.details.noExtraDetails')}
                    </span>
                  )}
                </div>
              ),
            }))}
          />
        ) : null}
      </SectionCard>
    </PageShell>
  );
}
