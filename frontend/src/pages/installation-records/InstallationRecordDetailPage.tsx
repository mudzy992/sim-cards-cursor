import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Button,
  Card,
  Descriptions,
  Image,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { installationRecordsApi } from '@/api/installation-records.api';
import { activityLogApi } from '@/api/activity-log.api';
import { meterTypeDefinitionsApi } from '@/api/meter-type-definitions.api';
import { useAuthStore } from '@/store/auth.store';
import type { InstallationRecordItem } from '@/types/installation-record.types';
import { RecordPhotoImage } from '@/components/installation-records/RecordPhotoImage';
import type { MeterTypeFieldItem } from '@/types/meter-type-field.types';
import { buildOsmEmbedUrl } from '@/utils/osm.utils'

const statusLabel: Record<string, string> = {
  DRAFT: 'Nacrt',
  SENT: 'Poslano',
  SEND_FAILED: 'Greška slanja',
  SEP_ACTIVATED: 'SEP aktiviran',
  LEGACY_COMPLETED: 'Legacy završeno',
};

const statusColor: Record<string, string> = {
  DRAFT: 'default',
  SENT: 'blue',
  SEND_FAILED: 'error',
  SEP_ACTIVATED: 'success',
  LEGACY_COMPLETED: 'default',
};

export default function InstallationRecordDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [pdfObjectUrl, setPdfObjectUrl] = useState<string | null>(null);

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
      messageApi.success('Zapisnik je označen kao SEP aktiviran.');
      void recordQuery.refetch();
      void permissionsQuery.refetch();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Akcija nije uspjela.';
      messageApi.error(msg);
    },
  });

  const retrySendMutation = useMutation({
    mutationFn: () => installationRecordsApi.retrySend(id!),
    onSuccess: () => {
      messageApi.success('Email je ponovo poslan.');
      void recordQuery.refetch();
      void permissionsQuery.refetch();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Akcija nije uspjela.';
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
      messageApi.success('PDF je preuzet.');
    } catch {
      messageApi.error('Preuzimanje PDF-a nije uspjelo.');
    }
  }, [id, recordQuery.data?.recordNumber, messageApi]);

  if (pdfQuery.data && !pdfObjectUrl) {
    const url = URL.createObjectURL(pdfQuery.data);
    setPdfObjectUrl(url);
  }

  const record = recordQuery.data;
  const canMarkSepActivated = !!permissionsQuery.data?.canMarkSepActivated;
  const canRetrySend = !!permissionsQuery.data?.canRetrySend;
  const canDownloadPdf = true;

  if (!id) {
    navigate('/installation-records');
    return null;
  }

  if (recordQuery.isLoading || !record) {
    return (
      <div className="flex items-center justify-center py-12">
        <Typography.Text>Učitavanje...</Typography.Text>
      </div>
    );
  }

  const formatDynamicFieldValue = (field: MeterTypeFieldItem, raw: unknown) => {
    if (raw === undefined || raw === null || raw === '') return null
    if (field.fieldType === 'BOOLEAN') {
      return raw === true || raw === 'true' ? 'Da' : 'Ne'
    }
    if (field.fieldType === 'DATE') {
      const d = new Date(String(raw))
      return Number.isNaN(d.getTime()) ? String(raw) : d.toLocaleDateString('bs-BA')
    }
    return String(raw)
  }

  if (recordQuery.isError) {
    return (
      <Typography.Text type="danger">
        {(recordQuery.error as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Zapisnik nije pronađen.'}
      </Typography.Text>
    );
  }

  return (
    <div className="space-y-4">
      {messageContextHolder}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Typography.Title level={3} className="!mb-0">
          Zapisnik {record.recordNumber}
        </Typography.Title>
        <Space>
          <Button onClick={() => navigate('/installation-records')}>Natrag na listu</Button>
          {canMarkSepActivated && (
            <Button
              type="primary"
              onClick={() => markSepActivatedMutation.mutate()}
              loading={markSepActivatedMutation.isPending}
            >
              Označi SEP aktiviran
            </Button>
          )}
          {canRetrySend && (
            <Button
              onClick={() => retrySendMutation.mutate()}
              loading={retrySendMutation.isPending}
            >
              Ponovo pošalji email
            </Button>
          )}
          {canDownloadPdf && (
            <Button onClick={handleDownloadPdf} loading={pdfQuery.isLoading}>
              Preuzmi PDF
            </Button>
          )}
        </Space>
      </div>

      <Card title="Podaci zapisnika">
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="Broj zapisnika">{record.recordNumber}</Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag color={statusColor[record.status]}>{statusLabel[record.status]}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Instalirao">
            {record.installedBy
              ? `${record.installedBy.firstName} ${record.installedBy.lastName}`
              : '–'}
          </Descriptions.Item>
          {record.approvedBy && (
            <Descriptions.Item label="Odobrio">
              {record.approvedBy.firstName} {record.approvedBy.lastName}
            </Descriptions.Item>
          )}
          {record.rejectionReason && (
            <Descriptions.Item label="Razlog odbijanja">
              {record.rejectionReason}
            </Descriptions.Item>
          )}
          {record.notes && (
            <Descriptions.Item label="Napomena">{record.notes}</Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      <Card title="Podaci o brojilu">
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="Serijski broj">{record.meter?.serialNumber ?? '–'}</Descriptions.Item>
          <Descriptions.Item label="Tip brojila">
            {record.meter?.meterTypeDefinition?.name ?? '–'}
          </Descriptions.Item>
          <Descriptions.Item label="Lokacija instalacije">
            {record.meter?.installationAddress ?? '–'}
          </Descriptions.Item>
          <Descriptions.Item label="Grad / Općina">
            {[record.meter?.city, record.meter?.municipality].filter(Boolean).join(', ') || '–'}
          </Descriptions.Item>
          <Descriptions.Item label="Datum instalacije">
            {record.meter?.installationDate
              ? new Date(record.meter.installationDate).toISOString().slice(0, 10)
              : '–'}
          </Descriptions.Item>
          <Descriptions.Item label="Mjerno mjesto">
            {record.meter?.measuringPoint ?? '–'}
          </Descriptions.Item>
          {(record.meter?.latitude != null || record.meter?.longitude != null) && (
            <>
              <Descriptions.Item label="GPS širina">
                {record.meter?.latitude != null ? String(record.meter.latitude) : '–'}
              </Descriptions.Item>
              <Descriptions.Item label="GPS dužina">
                {record.meter?.longitude != null ? String(record.meter.longitude) : '–'}
              </Descriptions.Item>
            </>
          )}
          <Descriptions.Item label="Status SIM-a">
            {record.meter?.simCard ? 'Ugrađena' : 'Bez kartice'}
          </Descriptions.Item>
          {record.meter?.simCard && (
            <>
              <Descriptions.Item label="ICCID">
                {record.meter.simCard.iccid ?? '–'}
              </Descriptions.Item>
              <Descriptions.Item label="IP adresa">
                {record.meter.simCard.ipAddress ?? '–'}
              </Descriptions.Item>
            </>
          )}
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
        </Descriptions>
      </Card>

      {(record.meter?.latitude != null && record.meter?.longitude != null) && (
        <Card title="Lokacija na mapi">
          <iframe
            title="Lokacija ugradnje"
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
        <Card title="Fotografije">
          <Image.PreviewGroup>
            <Space wrap>
              {record.photos.map((path, idx) => (
                <RecordPhotoImage
                  key={idx}
                  path={path}
                  alt={`Fotografija ${idx + 1}`}
                  width={120}
                  height={120}
                />
              ))}
            </Space>
          </Image.PreviewGroup>
        </Card>
      )}

      <Card title="Pregled PDF-a">
        {pdfQuery.isLoading && <Typography.Text>Generiranje PDF-a...</Typography.Text>}
        {pdfQuery.isError && (
          <Typography.Text type="secondary">PDF nije dostupan.</Typography.Text>
        )}
        {pdfObjectUrl && !pdfQuery.isLoading && (
            <iframe
              src={pdfObjectUrl}
              title="PDF pregled"
              className="w-full border rounded"
              style={{ minHeight: 480 }}
            />
        )}
      </Card>

      <Card title="Timeline aktivnosti">
        {timelineQuery.isLoading && (
          <Typography.Text>Učitavanje timeline-a...</Typography.Text>
        )}
        {timelineQuery.isError && (
          <Typography.Text type="secondary">
            Timeline trenutno nije dostupan.
          </Typography.Text>
        )}
        {timelineQuery.data && timelineQuery.data.items.length === 0 && (
          <Typography.Text type="secondary">
            Još nema zabilježenih aktivnosti za ovaj zapisnik.
          </Typography.Text>
        )}
        {timelineQuery.data && timelineQuery.data.items.length > 0 && (
          <ul className="space-y-2 mt-2">
            {timelineQuery.data.items.map((item) => (
              <li key={item.id} className="text-sm border-b pb-2 last:border-b-0">
                <div className="flex justify-between gap-2">
                  <span className="font-semibold">{item.action}</span>
                  <span className="text-xs text-gray-500">
                    {new Date(item.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {item.user
                    ? `${item.user.firstName} ${item.user.lastName} (${item.user.role})`
                    : 'Sistem'}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

    </div>
  );
}
