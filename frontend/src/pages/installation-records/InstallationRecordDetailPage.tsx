import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Button,
  Card,
  Descriptions,
  Dropdown,
  Grid,
  Image,
  Space,
  Tag,
  Timeline,
  Typography,
  message,
} from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { installationRecordsApi } from '@/api/installation-records.api';
import { activityLogApi } from '@/api/activity-log.api';
import { meterTypeDefinitionsApi } from '@/api/meter-type-definitions.api';
import { simCardsApi } from '@/api/sim-cards.api'
import type { InstallationRecordItem } from '@/types/installation-record.types';
import { RecordPhotoImage } from '@/components/installation-records/RecordPhotoImage';
import type { MeterTypeFieldItem } from '@/types/meter-type-field.types';
import { buildOsmEmbedUrl } from '@/utils/osm.utils'
import { useTranslation } from '@/i18n'
import { getActivityLogActionLabel, getSimCardStatusLabel } from '@/utils/labels.utils'

const statusLabelKey: Record<string, string> = {
  DRAFT: 'installationRecords.status.draft',
  SENT: 'installationRecords.status.sent',
  SEND_FAILED: 'installationRecords.status.sendFailed',
  SEP_ACTIVATED: 'installationRecords.status.sepActivated',
  LEGACY_COMPLETED: 'installationRecords.status.legacyCompleted',
};

const statusColor: Record<string, string> = {
  DRAFT: 'default',
  SENT: 'blue',
  SEND_FAILED: 'error',
  SEP_ACTIVATED: 'success',
  LEGACY_COMPLETED: 'default',
};

export default function InstallationRecordDetailPage() {
  const { t, language } = useTranslation()
  const dateLocale = language === 'bs' ? 'bs-BA' : 'en-US';
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [pdfObjectUrl, setPdfObjectUrl] = useState<string | null>(null);
  const screens = Grid.useBreakpoint()

  const recordQuery = useQuery({
    queryKey: ['installation-record', id],
    queryFn: () => installationRecordsApi.getById(id!),
    enabled: Boolean(id),
  });

  const meterTypeFieldsQuery = useQuery({
    queryKey: ['meter-type-definitions', 'fields', recordQuery.data?.meter?.meterTypeDefinitionId],
    queryFn: () =>
      meterTypeDefinitionsApi.listFields(
        (recordQuery.data as InstallationRecordItem).meter!.meterTypeDefinitionId!,
      ),
    enabled: Boolean(recordQuery.data?.meter?.meterTypeDefinitionId),
  })

  const demountedDefId =
    recordQuery.data?.kind === 'METER_REPLACEMENT' &&
    recordQuery.data?.demountedMeterSnapshot &&
    typeof (recordQuery.data.demountedMeterSnapshot as Record<string, unknown>).meterTypeDefinitionId ===
      'string'
      ? String((recordQuery.data.demountedMeterSnapshot as Record<string, unknown>).meterTypeDefinitionId)
      : undefined

  const demountedTypeQuery = useQuery({
    queryKey: ['meter-type-definitions', demountedDefId],
    queryFn: () => meterTypeDefinitionsApi.get(demountedDefId!),
    enabled: Boolean(demountedDefId),
  })

  const demountedFieldsQuery = useQuery({
    queryKey: ['meter-type-definitions', 'fields', demountedDefId],
    queryFn: () => meterTypeDefinitionsApi.listFields(demountedDefId!),
    enabled: Boolean(demountedDefId),
  })

  const permissionsQuery = useQuery({
    queryKey: ['installation-record-permissions', id],
    queryFn: () => installationRecordsApi.getPermissions(id!),
    enabled: Boolean(id),
  });

  const pdfQuery = useQuery({
    queryKey: ['installation-record-pdf', id],
    queryFn: () => installationRecordsApi.getPdfBlob(id!),
    enabled: Boolean(id) && !!recordQuery.data,
  });

  const timelineQuery = useQuery({
    queryKey: ['installation-record-timeline', id],
    queryFn: () =>
      activityLogApi.listForInstallationRecord(id!, {
        page: 1,
        limit: 50,
      }),
    enabled: Boolean(id),
  });

  useEffect(() => {
    if (!pdfQuery.data) return;
    const url = URL.createObjectURL(pdfQuery.data);
    setPdfObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pdfQuery.data]);

  const markSepActivatedMutation = useMutation({
    mutationFn: () => installationRecordsApi.markSepActivated(id!),
    onSuccess: () => {
      messageApi.success(t('installationRecords.detail.sepMarked'));
      void recordQuery.refetch();
      void permissionsQuery.refetch();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t('installationRecords.detail.actionFailed');
      messageApi.error(msg);
    },
  });

  const retrySendMutation = useMutation({
    mutationFn: () => installationRecordsApi.retrySend(id!),
    onSuccess: () => {
      messageApi.success(t('installationRecords.detail.emailResent'));
      void recordQuery.refetch();
      void permissionsQuery.refetch();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        t('installationRecords.detail.actionFailed');
      messageApi.error(msg);
    },
  });

  const handleDownloadPdf = useCallback(async () => {
    if (!id) return;
    try {
      const blob = await installationRecordsApi.getPdfBlob(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `zapisnik-${recordQuery.data?.recordNumber ?? id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      messageApi.success(t('installationRecords.detail.pdfDownloaded'));
    } catch {
      messageApi.error(t('installationRecords.detail.pdfDownloadFailed'));
    }
  }, [id, recordQuery.data?.recordNumber, messageApi]);

  if (pdfQuery.data && !pdfObjectUrl) {
    const url = URL.createObjectURL(pdfQuery.data);
    setPdfObjectUrl(url);
  }

  const record = recordQuery.data;
  const currentSimQuery = useQuery({
    queryKey: ['sim-cards', 'details', record?.simCard?.id],
    queryFn: () => simCardsApi.getById(record!.simCard!.id),
    enabled: Boolean(record?.simCard?.id),
  })

  const canMarkSepActivated = !!permissionsQuery.data?.canMarkSepActivated;
  const canRetrySend = !!permissionsQuery.data?.canRetrySend;
  const canDownloadPdf = true;
  const isMobile = !screens.sm

  if (!id) {
    navigate('/installation-records');
    return null;
  }

  if (recordQuery.isLoading || !record) {
    return (
      <div className="flex items-center justify-center py-12">
        <Typography.Text>{t('common.states.loading')}</Typography.Text>
      </div>
    );
  }

  const formatDynamicFieldValue = (field: MeterTypeFieldItem, raw: unknown) => {
    if (raw === undefined || raw === null || raw === '') return null
    if (field.fieldType === 'BOOLEAN') {
      return raw === true || raw === 'true' ? t('common.actions.yes') : t('common.actions.no')
    }
    if (field.fieldType === 'DATE') {
      const d = new Date(String(raw))
      return Number.isNaN(d.getTime()) ? String(raw) : d.toLocaleDateString(dateLocale)
    }
    return String(raw)
  }

  if (recordQuery.isError) {
    return (
      <Typography.Text type="danger">
        {(recordQuery.error as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? t('installationRecords.detail.notFound')}
      </Typography.Text>
    );
  }

  return (
    <div className="space-y-4">
      {messageContextHolder}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Typography.Title level={3} className="!mb-0">
          {t('installationRecords.detail.recordTitle', { number: record.recordNumber })}
        </Typography.Title>
        {isMobile ? (
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                { key: 'back', label: t('installationRecords.detail.backToList') },
                ...(canMarkSepActivated ? [{ key: 'sep', label: t('installationRecords.detail.markSep') }] : []),
                ...(canRetrySend ? [{ key: 'retry', label: t('installationRecords.detail.resendEmail') }] : []),
                ...(canDownloadPdf ? [{ key: 'pdf', label: t('installationRecords.detail.downloadPdf') }] : []),
              ],
              onClick: ({ key }) => {
                if (key === 'back') navigate('/installation-records')
                if (key === 'sep') markSepActivatedMutation.mutate()
                if (key === 'retry') retrySendMutation.mutate()
                if (key === 'pdf') void handleDownloadPdf()
              },
            }}
          >
            <Button type="primary">{t('common.actions.actions')}</Button>
          </Dropdown>
        ) : (
          <Space wrap>
            <Button onClick={() => navigate('/installation-records')}>{t('installationRecords.detail.backToList')}</Button>
            {canMarkSepActivated && (
              <Button
                type="primary"
                onClick={() => markSepActivatedMutation.mutate()}
                loading={markSepActivatedMutation.isPending}
              >
                {t('installationRecords.detail.markSep')}
              </Button>
            )}
            {canRetrySend && (
              <Button
                onClick={() => retrySendMutation.mutate()}
                loading={retrySendMutation.isPending}
              >
                {t('installationRecords.detail.resendEmail')}
              </Button>
            )}
            {canDownloadPdf && (
              <Button onClick={handleDownloadPdf} loading={pdfQuery.isLoading}>
                {t('installationRecords.detail.downloadPdf')}
              </Button>
            )}
          </Space>
        )}
      </div>

      <Card title={t('installationRecords.detail.recordDataTitle')}>
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label={t('installationRecords.list.columns.recordNumber')}>{record.recordNumber}</Descriptions.Item>
          {record.kind && (
            <Descriptions.Item label={t('installationRecords.form.recordKindLabel')}>
              {record.kind === 'METER_REPLACEMENT' ? t('installationRecords.form.kindMeterReplacement') : t('installationRecords.form.kindNewConnection')}
            </Descriptions.Item>
          )}
          <Descriptions.Item label={t('common.labels.status')}>
            <Tag color={statusColor[record.status]}>{statusLabelKey[record.status] ? t(statusLabelKey[record.status]) : record.status}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label={t('installationRecords.list.columns.installedBy')}>
            {record.installedBy
              ? `${record.installedBy.firstName} ${record.installedBy.lastName}`
              : '–'}
          </Descriptions.Item>
          {record.approvedBy && (
            <Descriptions.Item label={t('installationRecords.detail.approvedBy')}>
              {record.approvedBy.firstName} {record.approvedBy.lastName}
            </Descriptions.Item>
          )}
          {record.rejectionReason && (
            <Descriptions.Item label={t('installationRecords.detail.rejectionReason')}>
              {record.rejectionReason}
            </Descriptions.Item>
          )}
          {record.notes && (
            <Descriptions.Item label={t('common.labels.notes')}>{record.notes}</Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      {record.kind === 'METER_REPLACEMENT' && record.demountedMeterSnapshot && (
        <Card title={t('installationRecords.detail.demountedMeterCardTitle')}>
          <Descriptions column={1} bordered size="small">
            {(() => {
              const snap = record.demountedMeterSnapshot as Record<string, unknown>
              const serial = typeof snap.serialNumber === 'string' ? snap.serialNumber : '–'
              const year = snap.year != null ? String(snap.year) : '–'
              const calYear = snap.calibrationYear != null ? String(snap.calibrationYear) : '–'
              const hadSim = snap.hadIntegratedSim
              const noSimNote = typeof snap.noSimNote === 'string' ? snap.noSimNote : null
              return (
                <>
                  <Descriptions.Item label={t('installationRecords.form.demountedSerialLabel')}>{serial}</Descriptions.Item>
                  <Descriptions.Item label={t('installationRecords.form.demountedTypeLabel')}>
                    {demountedTypeQuery.data?.name ?? '–'}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('meterTypes.manufacturer')}>
                    {demountedTypeQuery.data?.manufacturer ?? '–'}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('meterTypes.model')}>{demountedTypeQuery.data?.model ?? '–'}</Descriptions.Item>
                  <Descriptions.Item label={t('installationRecords.form.yearLabel')}>{year}</Descriptions.Item>
                  <Descriptions.Item label={t('installationRecords.form.calibrationYearLabel')}>{calYear}</Descriptions.Item>
                  <Descriptions.Item label={t('installationRecords.form.hadIntegratedSimLabel')}>
                    {hadSim === true ? t('common.actions.yes') : hadSim === false ? t('common.actions.no') : '–'}
                  </Descriptions.Item>
                  {noSimNote ? (
                    <Descriptions.Item label={t('installationRecords.detail.noSimNoteLabel')}>{noSimNote}</Descriptions.Item>
                  ) : null}
                </>
              )
            })()}
            {(demountedFieldsQuery.data ?? [])
              .slice()
              .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
              .map((field) => {
                const snap = record.demountedMeterSnapshot as Record<string, unknown>
                const dyn = (snap.dynamicFieldValues as Record<string, unknown> | undefined) ?? {}
                const display = formatDynamicFieldValue(field, dyn[field.name])
                if (!display) return null
                return (
                  <Descriptions.Item key={field.id} label={field.label}>
                    {display}
                  </Descriptions.Item>
                )
              })}
            {(() => {
              const snap = record.demountedMeterSnapshot as Record<string, unknown>
              const notes = typeof snap.notes === 'string' ? snap.notes : null
              return notes ? (
                <Descriptions.Item label={t('installationRecords.detail.meterNotesLabel')}>{notes}</Descriptions.Item>
              ) : null
            })()}
          </Descriptions>
        </Card>
      )}

      <Card title={t('installationRecords.detail.meterDataTitle')}>
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label={t('installationRecords.form.meterSerialLabel')}>{record.meter?.serialNumber ?? '–'}</Descriptions.Item>
          <Descriptions.Item label={t('installationRecords.form.meterTypeLabel')}>
            {record.meter?.meterTypeDefinition?.name ?? '–'}
          </Descriptions.Item>
          <Descriptions.Item label={t('installationRecords.detail.installationLocationLabel')}>
            {record.meter?.installationAddress ?? '–'}
          </Descriptions.Item>
          <Descriptions.Item label={t('installationRecords.detail.cityMunicipalityLabel')}>
            {[record.meter?.city, record.meter?.municipality].filter(Boolean).join(', ') || '–'}
          </Descriptions.Item>
          <Descriptions.Item label={t('installationRecords.list.columns.installationDate')}>
            {record.meter?.installationDate
              ? new Date(record.meter.installationDate).toISOString().slice(0, 10)
              : '–'}
          </Descriptions.Item>
          <Descriptions.Item label={t('installationRecords.form.measuringPointLabel')}>
            {record.meter?.measuringPoint ?? '–'}
          </Descriptions.Item>
          {(record.meter?.dynamicFieldValues &&
            Object.keys(record.meter.dynamicFieldValues).length > 0 &&
            (meterTypeFieldsQuery.data ?? []).some((f) => {
              const vals = record.meter?.dynamicFieldValues as Record<string, unknown>
              const v = vals?.[f.name]
              return v !== undefined && v !== null && v !== ''
            })) && (
            <>
              {(meterTypeFieldsQuery.data ?? [])
                .slice()
                .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                .map((field) => {
                  const vals = (record.meter?.dynamicFieldValues ?? {}) as Record<string, unknown>
                  const display = formatDynamicFieldValue(field, vals[field.name])
                  if (!display) return null
                  return (
                    <Descriptions.Item key={field.id} label={field.label}>
                      {display}
                    </Descriptions.Item>
                  )
                })}
            </>
          )}
          {(record.meter?.latitude != null || record.meter?.longitude != null) && (
            <>
              <Descriptions.Item label={t('installationRecords.form.gpsLatLabel')}>
                {record.meter?.latitude != null ? String(record.meter.latitude) : '–'}
              </Descriptions.Item>
              <Descriptions.Item label={t('installationRecords.form.gpsLngLabel')}>
                {record.meter?.longitude != null ? String(record.meter.longitude) : '–'}
              </Descriptions.Item>
            </>
          )}
          <Descriptions.Item label={t('installationRecords.detail.simStatusLabel')}>
            {record.simCard ? t('installationRecords.detail.simInstalledFromRecord') : record.meter?.simCard ? t('installationRecords.detail.simInstalledCurrently') : t('installationRecords.detail.simNone')}
          </Descriptions.Item>
          {(record.simCard ?? record.meter?.simCard) && (
            <>
              <Descriptions.Item label="ICCID">
                <Space wrap size={10}>
                  {record.simCard?.id ? (
                    <Link to={`/sim-cards/${record.simCard.id}`}>
                      {record.simCard.iccid ?? '–'}
                    </Link>
                  ) : (
                    <span>{(record.simCard ?? record.meter?.simCard)?.iccid ?? '–'}</span>
                  )}
                  {record.simCard?.id && currentSimQuery.data ? (
                    <Tag color="blue">
                      {t('installationRecords.detail.currentlyLabel')} {getSimCardStatusLabel(currentSimQuery.data.status, t)}
                    </Tag>
                  ) : null}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label={t('simCards.details.ipAddress')}>
                {(record.simCard ?? record.meter?.simCard)?.ipAddress ?? '–'}
              </Descriptions.Item>
            </>
          )}
        </Descriptions>
      </Card>

      {(record.meter?.latitude != null && record.meter?.longitude != null) && (
        <Card title={t('installationRecords.detail.mapCardTitle')}>
          <iframe
            title={t('installationRecords.detail.mapIframeTitle')}
            src={buildOsmEmbedUrl({
              latitude: Number(record.meter.latitude),
              longitude: Number(record.meter.longitude),
              radiusMeters: 50,
            })}
            width="100%"
            height="280"
            style={{ border: 0, borderRadius: 8 }}
            loading="lazy"
          />
        </Card>
      )}

      {record.photos && Array.isArray(record.photos) && record.photos.length > 0 && (
        <Card title={t('installationRecords.detail.photosCardTitle')}>
          <Image.PreviewGroup>
            <Space wrap>
              {record.photos.map((path, idx) => (
                <RecordPhotoImage
                  key={idx}
                  path={path}
                  alt={t('installationRecords.detail.photoAlt', { index: idx + 1 })}
                  width={120}
                  height={120}
                />
              ))}
            </Space>
          </Image.PreviewGroup>
        </Card>
      )}

      <Card title={t('installationRecords.detail.pdfCardTitle')}>
        {pdfQuery.isLoading && <Typography.Text>{t('installationRecords.detail.pdfGenerating')}</Typography.Text>}
        {pdfQuery.isError && (
          <Typography.Text type="secondary">{t('installationRecords.detail.pdfUnavailable')}</Typography.Text>
        )}
        {pdfObjectUrl && !pdfQuery.isLoading && (
            <iframe
              src={pdfObjectUrl}
              title={t('installationRecords.detail.pdfPreviewTitle')}
              className="w-full border rounded"
              style={{ minHeight: 480 }}
            />
        )}
      </Card>

      <Card title={t('installationRecords.detail.timelineCardTitle')}>
        {timelineQuery.isLoading && (
          <Typography.Text>{t('installationRecords.detail.timelineLoading')}</Typography.Text>
        )}
        {timelineQuery.isError && (
          <Typography.Text type="secondary">
            {t('installationRecords.detail.timelineUnavailable')}
          </Typography.Text>
        )}
        {timelineQuery.data && timelineQuery.data.items.length === 0 && (
          <Typography.Text type="secondary">
            {t('installationRecords.detail.timelineEmpty')}
          </Typography.Text>
        )}
        {timelineQuery.data && timelineQuery.data.items.length > 0 && (
          <Timeline
            className="mt-2"
            items={timelineQuery.data.items.map((item) => ({
              key: item.id,
              children: (
                <div className="flex flex-col gap-1">
                  <div className="flex items-start justify-between gap-4">
                    <Typography.Text strong>{getActivityLogActionLabel(item.action, t)}</Typography.Text>
                    <Typography.Text type="secondary" className="text-xs whitespace-nowrap">
                      {new Date(item.createdAt).toLocaleString(dateLocale)}
                    </Typography.Text>
                  </div>
                  <Typography.Text type="secondary" className="text-xs">
                    {item.user
                      ? `${item.user.firstName} ${item.user.lastName} (${item.user.role})`
                      : t('installationRecords.detail.system')}
                  </Typography.Text>
                </div>
              ),
            }))}
          />
        )}
      </Card>

    </div>
  );
}
