import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Button,
  Card,
  Checkbox,
  Descriptions,
  Image,
  Input,
  Modal,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { installationRecordsApi } from '@/api/installation-records.api';
import { activityLogApi } from '@/api/activity-log.api';
import { recipientsApi } from '@/api/recipients.api';
import { useAuthStore } from '@/store/auth.store';
import type { InstallationRecordItem } from '@/types/installation-record.types';
import { RecordPhotoImage } from '@/components/installation-records/RecordPhotoImage';

const statusLabel: Record<string, string> = {
  DRAFT: 'Nacrt',
  PENDING: 'Čeka odobrenje',
  SUBMIT_FAILED: 'Greška pri slanju',
  REJECTED: 'Odbijeno',
  WAITING_SEP_ACTIVATION: 'Čeka aktivaciju SEP',
  ACTIVATED_IN_SEP: 'Aktivirano u SEP',
  SENT: 'Poslano',
};

const statusColor: Record<string, string> = {
  DRAFT: 'default',
  PENDING: 'processing',
  SUBMIT_FAILED: 'error',
  REJECTED: 'error',
  WAITING_SEP_ACTIVATION: 'warning',
  ACTIVATED_IN_SEP: 'success',
  SENT: 'blue',
};

export default function InstallationRecordDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [approveRejectModalOpen, setApproveRejectModalOpen] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [pdfObjectUrl, setPdfObjectUrl] = useState<string | null>(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [manualEmails, setManualEmails] = useState('');

  const groupsQuery = useQuery({
    queryKey: ['recipient-groups'],
    queryFn: () => recipientsApi.listGroups(),
    enabled: sendModalOpen,
  });

  const recordQuery = useQuery({
    queryKey: ['installation-record', id],
    queryFn: () => installationRecordsApi.getById(id!),
    enabled: Boolean(id),
  });

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

  const approveMutation = useMutation({
    mutationFn: () => installationRecordsApi.approve(id!),
    onSuccess: () => {
      messageApi.success('Zapisnik je odobren.');
      setApproveRejectModalOpen(false);
      void recordQuery.refetch();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Odobravanje nije uspjelo.';
      messageApi.error(msg);
    },
  });

  const submitForApprovalMutation = useMutation({
    mutationFn: () => installationRecordsApi.submitForApproval(id!),
    onSuccess: () => {
      messageApi.success('Zapisnik je poslan na odobrenje.');
      void recordQuery.refetch();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Slanje na odobrenje nije uspjelo.';
      messageApi.error(msg);
    },
  });

  const activateInSepMutation = useMutation({
    mutationFn: () => installationRecordsApi.activateInSep(id!),
    onSuccess: () => {
      messageApi.success('Zapisnik je označen kao aktiviran u SEP.');
      void recordQuery.refetch();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Greška.';
      messageApi.error(msg);
    },
  });

  const sendMutation = useMutation({
    mutationFn: () =>
      installationRecordsApi.send(id!, {
        recipientGroupIds:
          selectedGroupIds.length > 0 ? selectedGroupIds : undefined,
        manualEmails: manualEmails
          ? manualEmails.split(/[\s,;]+/).filter((e) => e.trim())
          : undefined,
      }),
    onSuccess: () => {
      messageApi.success('Zapisnik je poslan email-om.');
      setSendModalOpen(false);
      setSelectedGroupIds([]);
      setManualEmails('');
      void recordQuery.refetch();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Slanje nije uspjelo.';
      messageApi.error(msg);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => installationRecordsApi.reject(id!, rejectReason),
    onSuccess: () => {
      messageApi.success('Zapisnik je odbijen.');
      setApproveRejectModalOpen(false);
      setRejectReason('');
      void recordQuery.refetch();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Odbijanje nije uspjelo.';
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
  const role = useAuthStore((s) => s.user?.role);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const canSubmitForApproval =
    record?.status === 'DRAFT' &&
    (record.installedById === currentUserId ||
      role === 'SYSTEM_ADMIN' ||
      role === 'MODERATOR');
  const canApproveReject =
    role === 'USER'
      ? !!permissionsQuery.data?.canApproveReject
      : (role === 'SYSTEM_ADMIN' || role === 'MODERATOR') &&
        record?.status === 'PENDING';
  const canActivateSep =
    role === 'USER'
      ? !!permissionsQuery.data?.canActivateSep
      : (role === 'SYSTEM_ADMIN' || role === 'MODERATOR') &&
        record?.status === 'WAITING_SEP_ACTIVATION';
  const canSend =
    (role === 'SYSTEM_ADMIN' || role === 'MODERATOR') &&
    record?.status === 'ACTIVATED_IN_SEP';
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
          {canSubmitForApproval && (
            <Button
              type="primary"
              onClick={() => submitForApprovalMutation.mutate()}
              loading={submitForApprovalMutation.isPending}
            >
              Pošalji na odobrenje
            </Button>
          )}
          {canApproveReject && (
            <Button type="primary" onClick={() => setApproveRejectModalOpen(true)}>
              Odobri / Odbij
            </Button>
          )}
          {canActivateSep && (
            <Button
              type="primary"
              onClick={() => activateInSepMutation.mutate()}
              loading={activateInSepMutation.isPending}
            >
              Aktiviraj u SEP
            </Button>
          )}
          {canSend && (
            <Button onClick={() => setSendModalOpen(true)}>Pošalji PDF email</Button>
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
          <Descriptions.Item label="ICCID">{record.meter?.simCard?.iccid ?? '–'}</Descriptions.Item>
          <Descriptions.Item label="Brojilo">
            {record.meter
              ? `${record.meter.serialNumber}${record.meter.meterTypeDefinition ? ` (${record.meter.meterTypeDefinition.name})` : ''}`
              : '–'}
          </Descriptions.Item>
          <Descriptions.Item label="Adresa ugradnje">
            {record.meter?.installationAddress ?? '–'}
          </Descriptions.Item>
          <Descriptions.Item label="Grad / Općina">
            {[record.meter?.city, record.meter?.municipality].filter(Boolean).join(', ') || '–'}
          </Descriptions.Item>
          <Descriptions.Item label="Datum ugradnje">
            {record.meter?.installationDate
              ? new Date(record.meter.installationDate).toLocaleDateString()
              : '–'}
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

      {(record.meter?.latitude != null && record.meter?.longitude != null) && (
        <Card title="Lokacija na mapi">
          <iframe
            title="Lokacija ugradnje"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${
              Number(record.meter.longitude) - 0.01
            },${Number(record.meter.latitude) - 0.01},${
              Number(record.meter.longitude) + 0.01
            },${Number(record.meter.latitude) + 0.01}&layer=mapnik&marker=${record.meter.latitude},${
              record.meter.longitude
            }`}
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

      <Modal
        title="Odobri ili odbij zapisnik"
        open={approveRejectModalOpen}
        onCancel={() => {
          setApproveRejectModalOpen(false);
          setRejectReason('');
        }}
        footer={null}
        destroyOnClose
      >
        <Space direction="vertical" className="w-full" size="middle">
          <Button
            type="primary"
            block
            loading={approveMutation.isPending}
            onClick={() => approveMutation.mutate()}
          >
            Odobri zapisnik
          </Button>
          <div>
            <Typography.Text type="secondary">Razlog odbijanja (obavezno za odbijanje):</Typography.Text>
            <Input.TextArea
              rows={3}
              value={rejectReason}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRejectReason(e.target.value)}
              placeholder="Unesite razlog odbijanja"
              className="mt-1"
            />
          </div>
          <Button
            danger
            block
            loading={rejectMutation.isPending}
            disabled={!rejectReason.trim()}
            onClick={() => rejectMutation.mutate()}
          >
            Odbij zapisnik
          </Button>
        </Space>
      </Modal>

      <Modal
        title="Pošalji zapisnik email-om"
        open={sendModalOpen}
        onCancel={() => {
          setSendModalOpen(false);
          setSelectedGroupIds([]);
          setManualEmails('');
        }}
        onOk={() => sendMutation.mutate()}
        okText="Pošalji"
        confirmLoading={sendMutation.isPending}
        okButtonProps={{
          disabled:
            selectedGroupIds.length === 0 && !manualEmails.trim(),
        }}
        destroyOnClose
      >
        <Space direction="vertical" className="w-full" size="middle">
          <div>
            <Typography.Text strong>Odaberi grupe primalaca:</Typography.Text>
            <div className="mt-2 space-y-2">
              {groupsQuery.data?.map((g) => (
                <Checkbox
                  key={g.id}
                  checked={selectedGroupIds.includes(g.id)}
                  onChange={(e) =>
                    setSelectedGroupIds((prev) =>
                      e.target.checked
                        ? [...prev, g.id]
                        : prev.filter((id) => id !== g.id),
                    )
                  }
                >
                  {g.name} ({g.recipients?.length ?? 0} primalaca)
                </Checkbox>
              ))}
              {(!groupsQuery.data || groupsQuery.data.length === 0) && (
                <Typography.Text type="secondary">
                  Nema grupa. Kreirajte grupe na stranici Primaoci.
                </Typography.Text>
              )}
            </div>
          </div>
          <div>
            <Typography.Text strong>
              Dodatne email adrese (odvojene zarezom):
            </Typography.Text>
            <Input.TextArea
              rows={2}
              value={manualEmails}
              onChange={(e) => setManualEmails(e.target.value)}
              placeholder="email1@example.com, email2@example.com"
              className="mt-1"
            />
          </div>
        </Space>
      </Modal>
    </div>
  );
}
