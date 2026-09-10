import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftOutlined, UploadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { shipmentsApi } from '@/api/shipments.api';
import { distributionsApi } from '@/api/distributions.api';
import { useAuthStore } from '@/store/auth.store';
import type {
  CreateShipmentInput,
  ImportColumnMapping,
  ShipmentImportPreview,
  ShipmentItem,
} from '@/types/shipment.types';
import { useTranslation } from '@/i18n';

const importKeys: Array<keyof ImportColumnMapping> = [
  'iccid',
  'ipAddress',
  'publicIpAddress',
  'phoneNumber',
  'apn',
];

export default function ShipmentCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [messageApi, messageContextHolder] = message.useMessage();
  const currentUser = useAuthStore((s) => s.user);
  const isDistAdmin = currentUser?.role === 'DIST_ADMIN';
  const distAdminDistributionId = currentUser?.distributionId ?? null;
  const [createForm] = Form.useForm<{
    name: string;
    provider: string;
    receivedDate: dayjs.Dayjs;
    notes?: string;
    distributionId: string;
  }>();

  useEffect(() => {
    if (!isDistAdmin) return;
    if (!distAdminDistributionId) return;
    createForm.setFieldsValue({ distributionId: distAdminDistributionId });
  }, [createForm, distAdminDistributionId, isDistAdmin]);

  const distributionsQuery = useQuery({
    queryKey: ['distributions', 'list'],
    queryFn: () => distributionsApi.list(),
    enabled: !isDistAdmin,
  });

  const shipmentsQuery = useQuery({
    queryKey: ['shipments', 'list', { page: 1, limit: 100 }],
    queryFn: () => shipmentsApi.list({ page: 1, limit: 100 }),
  });

  const [importShipmentId, setImportShipmentId] = useState<string | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ShipmentImportPreview | null>(null);
  const [mapping, setMapping] = useState<ImportColumnMapping>({});
  const [previewPagination, setPreviewPagination] = useState({ page: 1, pageSize: 50 })

  const rows = shipmentsQuery.data?.items ?? [];
  const distributions = (distributionsQuery.data ?? []) as Array<{ id: string; name: string; code: string }>;

  const createMutation = useMutation({
    mutationFn: (payload: CreateShipmentInput) => shipmentsApi.create(payload),
    onSuccess: async () => {
      messageApi.success(t('shipments.createLegacy.created'));
      createForm.resetFields();
      await queryClient.invalidateQueries({ queryKey: ['shipments', 'list'] });
    },
    onError: () => {
      messageApi.error(t('shipments.createLegacy.createFailed'));
    },
  });

  const previewMutation = useMutation({
    mutationFn: () => {
      if (!importShipmentId || !importFile) {
        throw new Error(t('shipments.createLegacy.shipmentFileRequiredPreview'));
      }
      return shipmentsApi.importExcel({
        shipmentId: importShipmentId,
        file: importFile,
        applyImport: false,
        columnMapping: mapping,
      });
    },
    onSuccess: (result) => {
      if (result.mode !== 'preview') return;
      setPreview(result);
      setPreviewPagination({ page: 1, pageSize: 50 })
      setMapping({
        iccid: result.resolvedMapping.iccid ?? undefined,
        ipAddress: result.resolvedMapping.ipAddress ?? undefined,
        publicIpAddress: result.resolvedMapping.publicIpAddress ?? undefined,
        phoneNumber: result.resolvedMapping.phoneNumber ?? undefined,
        apn: result.resolvedMapping.apn ?? undefined,
      });
      messageApi.success(t('shipments.createLegacy.previewReady'));
    },
    onError: (error: unknown) => {
      const text =
        typeof (error as { response?: { data?: { message?: string } } })?.response?.data
          ?.message === 'string'
          ? (error as { response: { data: { message: string } } }).response.data.message
          : t('shipments.createLegacy.previewFailed');
      messageApi.error(text);
    },
  });

  const applyMutation = useMutation({
    mutationFn: () => {
      if (!importShipmentId || !importFile) {
        throw new Error(t('shipments.createLegacy.shipmentFileRequiredImport'));
      }
      return shipmentsApi.importExcel({
        shipmentId: importShipmentId,
        file: importFile,
        applyImport: true,
        columnMapping: mapping,
      });
    },
    onSuccess: async (result) => {
      if (result.mode !== 'import') return;
      messageApi.success(t('shipments.createLegacy.importDone', { count: result.insertedRows }));
      setPreview(null);
      setPreviewPagination({ page: 1, pageSize: 50 })
      await queryClient.invalidateQueries({ queryKey: ['shipments', 'list'] });
      await queryClient.invalidateQueries({ queryKey: ['sim-cards', 'list'] });
    },
    onError: (error: unknown) => {
      const maybeMessage = (error as { response?: { data?: { message?: string } } })?.response
        ?.data?.message;
      if (typeof maybeMessage === 'string') {
        messageApi.error(maybeMessage);
        return;
      }
      messageApi.error(t('shipments.import.importFailed'));
    },
  });

  const headerOptions = useMemo(
    () => (preview?.headers ?? []).map((header) => ({ label: header, value: header })),
    [preview?.headers],
  );

  return (
    <div className="space-y-6">
      {messageContextHolder}
      <div className="flex items-center justify-between">
        <Typography.Title level={3} className="!mb-0">
          {t('shipments.list.newShipment')}
        </Typography.Title>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/shipments')}>
          {t('shipments.createLegacy.backToList')}
        </Button>
      </div>

      <Card title={t('shipments.createLegacy.createCardTitle')}>
        <Form
          form={createForm}
          layout="vertical"
          onFinish={(values) => {
            void createMutation.mutate({
              name: values.name,
              provider: values.provider,
              receivedDate: values.receivedDate.toISOString(),
              notes: values.notes,
              distributionId: values.distributionId,
            });
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Form.Item
              name="distributionId"
              label={t('shipments.wizard.distributionLabel')}
              rules={[{ required: true, message: t('shipments.createLegacy.distributionRequired') }]}
            >
              <Select
                placeholder={t('shipments.wizard.selectDistributionPlaceholder')}
                options={distributions.map((d) => ({ label: `${d.name} (${d.code})`, value: d.id }))}
                loading={distributionsQuery.isLoading}
                disabled={isDistAdmin}
              />
            </Form.Item>
            <Form.Item name="name" label={t('common.labels.name')} rules={[{ required: true, message: t('installationRecords.form.requiredShort') }]}>
              <Input placeholder="Isporuka 2026-03-07" />
            </Form.Item>
            <Form.Item
              name="provider"
              label={t('shipments.details.provider')}
              rules={[{ required: true, message: t('installationRecords.form.requiredShort') }]}
            >
              <Input placeholder={t('shipments.createLegacy.providerNamePlaceholder')} />
            </Form.Item>
            <Form.Item
              name="receivedDate"
              label={t('shipments.details.receivedDate')}
              rules={[{ required: true, message: t('installationRecords.form.requiredShort') }]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="notes" label={t('common.labels.notes')}>
              <Input placeholder={t('common.labels.optional')} />
            </Form.Item>
          </div>
          <Button type="primary" htmlType="submit" loading={createMutation.isPending}>
            {t('shipments.list.newShipment')}
          </Button>
        </Form>
      </Card>

      <Card title={t('shipments.createLegacy.excelImportTitle')}>
        <Typography.Paragraph type="secondary" className="mb-4">
          {t('shipments.createLegacy.excelImportIntro')}
        </Typography.Paragraph>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Space wrap>
            <Select
              placeholder={t('shipments.createLegacy.selectShipmentPlaceholder')}
              style={{ width: 320 }}
              value={importShipmentId ?? undefined}
              onChange={(value) => setImportShipmentId(value)}
              options={rows.map((item: ShipmentItem) => ({
                value: item.id,
                label: `${item.name} (${item.provider})`,
              }))}
              loading={shipmentsQuery.isLoading}
            />
            <Upload
              beforeUpload={(file) => {
                setImportFile(file as File);
                return false;
              }}
              maxCount={1}
              accept=".xlsx,.xls,.csv"
              onRemove={() => {
                setImportFile(null);
                setPreview(null);
              }}
            >
              <Button icon={<UploadOutlined />}>{t('shipments.createLegacy.chooseFile')}</Button>
            </Upload>
            <Button
              type="default"
              onClick={() => void previewMutation.mutate()}
              loading={previewMutation.isPending}
              disabled={!importShipmentId || !importFile}
            >
              {t('shipments.createLegacy.previewButton')}
            </Button>
          </Space>

          {preview ? (
            <>
              <Alert
                type={preview.canImport ? 'success' : 'warning'}
                message={t('shipments.createLegacy.previewSummary', {
                  total: preview.summary.totalRows,
                  valid: preview.summary.validRows,
                  invalid: preview.summary.invalidRows,
                  dupFile: preview.summary.duplicatesInFile,
                  dupDb: preview.summary.duplicatesInDatabase,
                })}
              />

              <Card size="small" title={t('shipments.import.columnMapping')}>
                <Space wrap>
                  {importKeys.map((key) => (
                    <div key={key}>
                      <Typography.Text>{key}</Typography.Text>
                      <Select
                        style={{ width: 220, display: 'block', marginTop: 6 }}
                        allowClear
                        value={(mapping[key] as string | undefined) ?? undefined}
                        onChange={(value) => {
                          setMapping((prev) => ({ ...prev, [key]: value }));
                        }}
                        options={headerOptions}
                        placeholder={t('shipments.createLegacy.selectColumnPlaceholder')}
                      />
                    </div>
                  ))}
                </Space>
                <Space style={{ marginTop: 12 }}>
                  <Button
                    onClick={() => void previewMutation.mutate()}
                    loading={previewMutation.isPending}
                  >
                    {t('shipments.import.refreshPreview')}
                  </Button>
                  <Button
                    type="primary"
                    disabled={!preview.canImport}
                    loading={applyMutation.isPending}
                    onClick={() => void applyMutation.mutate()}
                  >
                    {t('shipments.createLegacy.confirmImport')}
                  </Button>
                </Space>
              </Card>

              <Table
                rowKey="rowNumber"
                dataSource={preview.previewRows}
                pagination={{
                  current: previewPagination.page,
                  pageSize: previewPagination.pageSize,
                  total: preview.previewRows.length,
                  showSizeChanger: true,
                  pageSizeOptions: ['50', '100', '200', '500'],
                  showTotal: (total) => t('common.pagination.totalItems', { count: total }),
                  onChange: (page, pageSize) => {
                    setPreviewPagination({ page, pageSize })
                  },
                }}
                size="small"
                columns={[
                  { title: t('shipments.createLegacy.rowColumn'), dataIndex: 'rowNumber', width: 90 },
                  { title: 'ICCID', render: (_: unknown, row: { data: Record<string, unknown> }) => row.data.iccid ?? '-' },
                  { title: 'EPBIH IP', render: (_: unknown, row: { data: Record<string, unknown> }) => row.data.ipAddress ?? '-' },
                  { title: t('shipments.createLegacy.ipAddressColumn'), render: (_: unknown, row: { data: Record<string, unknown> }) => row.data.publicIpAddress ?? '-' },
                  { title: 'MSISDN', render: (_: unknown, row: { data: Record<string, unknown> }) => row.data.phoneNumber ?? '-' },
                  {
                    title: t('shipments.createLegacy.errorsColumn'),
                    render: (
                      _: unknown,
                      row: { data: Record<string, unknown>; errors?: string[] },
                    ) =>
                      (row.errors?.length ?? 0) > 0 ? (
                        <Space wrap>
                          {(row.errors ?? []).map((error: string) => (
                            <Tag color="red" key={error}>
                              {error}
                            </Tag>
                          ))}
                        </Space>
                      ) : (
                        <Tag color="green">OK</Tag>
                      ),
                  },
                ]}
              />
            </>
          ) : null}
        </Space>
      </Card>
    </div>
  );
}
