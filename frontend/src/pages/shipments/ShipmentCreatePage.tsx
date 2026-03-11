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
import { useMemo, useState } from 'react';
import { ArrowLeftOutlined, UploadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { shipmentsApi } from '@/api/shipments.api';
import { distributionsApi } from '@/api/distributions.api';
import type {
  CreateShipmentInput,
  ImportColumnMapping,
  ShipmentImportPreview,
  ShipmentItem,
} from '@/types/shipment.types';

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
  const [messageApi, messageContextHolder] = message.useMessage();
  const [createForm] = Form.useForm<{
    name: string;
    provider: string;
    receivedDate: dayjs.Dayjs;
    notes?: string;
    distributionId: string;
  }>();

  const distributionsQuery = useQuery({
    queryKey: ['distributions', 'list'],
    queryFn: () => distributionsApi.list(),
  });

  const shipmentsQuery = useQuery({
    queryKey: ['shipments', 'list', { page: 1, limit: 100 }],
    queryFn: () => shipmentsApi.list({ page: 1, limit: 100 }),
  });

  const [importShipmentId, setImportShipmentId] = useState<string | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ShipmentImportPreview | null>(null);
  const [mapping, setMapping] = useState<ImportColumnMapping>({});

  const rows = shipmentsQuery.data?.items ?? [];
  const distributions = (distributionsQuery.data ?? []) as Array<{ id: string; name: string; code: string }>;

  const createMutation = useMutation({
    mutationFn: (payload: CreateShipmentInput) => shipmentsApi.create(payload),
    onSuccess: async () => {
      messageApi.success('Isporuka je kreirana.');
      createForm.resetFields();
      await queryClient.invalidateQueries({ queryKey: ['shipments', 'list'] });
    },
    onError: () => {
      messageApi.error('Kreiranje isporuke nije uspjelo.');
    },
  });

  const previewMutation = useMutation({
    mutationFn: () => {
      if (!importShipmentId || !importFile) {
        throw new Error('Isporuka i fajl su obavezni za preview.');
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
      setMapping({
        iccid: result.resolvedMapping.iccid ?? undefined,
        ipAddress: result.resolvedMapping.ipAddress ?? undefined,
        publicIpAddress: result.resolvedMapping.publicIpAddress ?? undefined,
        phoneNumber: result.resolvedMapping.phoneNumber ?? undefined,
        apn: result.resolvedMapping.apn ?? undefined,
      });
      messageApi.success('Preview je spreman.');
    },
    onError: (error: unknown) => {
      const text =
        typeof (error as { response?: { data?: { message?: string } } })?.response?.data
          ?.message === 'string'
          ? (error as { response: { data: { message: string } } }).response.data.message
          : 'Preview nije uspio.';
      messageApi.error(text);
    },
  });

  const applyMutation = useMutation({
    mutationFn: () => {
      if (!importShipmentId || !importFile) {
        throw new Error('Isporuka i fajl su obavezni za import.');
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
      messageApi.success(`Import završen. Ubačeno redova: ${result.insertedRows}.`);
      setPreview(null);
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
      messageApi.error('Import nije uspio.');
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
          Nova isporuka
        </Typography.Title>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/shipments')}>
          Natrag na listu
        </Button>
      </div>

      <Card title="Kreiraj isporuku">
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
              label="Distribucija"
              rules={[{ required: true, message: 'Obavezno – isporuka se dodjeljuje distribuciji' }]}
            >
              <Select
                placeholder="Odaberi distribuciju"
                options={distributions.map((d) => ({ label: `${d.name} (${d.code})`, value: d.id }))}
                loading={distributionsQuery.isLoading}
              />
            </Form.Item>
            <Form.Item name="name" label="Naziv" rules={[{ required: true, message: 'Obavezno' }]}>
              <Input placeholder="Isporuka 2026-03-07" />
            </Form.Item>
            <Form.Item
              name="provider"
              label="Provajder"
              rules={[{ required: true, message: 'Obavezno' }]}
            >
              <Input placeholder="Naziv provajdera" />
            </Form.Item>
            <Form.Item
              name="receivedDate"
              label="Datum prijema"
              rules={[{ required: true, message: 'Obavezno' }]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="notes" label="Napomena">
              <Input placeholder="Opcionalno" />
            </Form.Item>
          </div>
          <Button type="primary" htmlType="submit" loading={createMutation.isPending}>
            Kreiraj isporuku
          </Button>
        </Form>
      </Card>

      <Card title="Excel Import">
        <Typography.Paragraph type="secondary" className="mb-4">
          Odaberi isporuku, učitaj Excel/CSV fajl, mapiraj kolone i potvrdi import.
        </Typography.Paragraph>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Space wrap>
            <Select
              placeholder="Odaberi isporuku"
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
              <Button icon={<UploadOutlined />}>Odaberi fajl</Button>
            </Upload>
            <Button
              type="default"
              onClick={() => void previewMutation.mutate()}
              loading={previewMutation.isPending}
              disabled={!importShipmentId || !importFile}
            >
              Preview
            </Button>
          </Space>

          {preview ? (
            <>
              <Alert
                type={preview.canImport ? 'success' : 'warning'}
                message={`Ukupno: ${preview.summary.totalRows}, validno: ${preview.summary.validRows}, nevalidno: ${preview.summary.invalidRows}, duplikati (fajl): ${preview.summary.duplicatesInFile}, duplikati (baza): ${preview.summary.duplicatesInDatabase}`}
              />

              <Card size="small" title="Mapiranje kolona">
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
                        placeholder="Odaberi kolonu"
                      />
                    </div>
                  ))}
                </Space>
                <Space style={{ marginTop: 12 }}>
                  <Button
                    onClick={() => void previewMutation.mutate()}
                    loading={previewMutation.isPending}
                  >
                    Osvježi preview
                  </Button>
                  <Button
                    type="primary"
                    disabled={!preview.canImport}
                    loading={applyMutation.isPending}
                    onClick={() => void applyMutation.mutate()}
                  >
                    Potvrdi import
                  </Button>
                </Space>
              </Card>

              <Table
                rowKey="rowNumber"
                dataSource={preview.previewRows}
                pagination={false}
                size="small"
                columns={[
                  { title: 'Red', dataIndex: 'rowNumber', width: 90 },
                  { title: 'ICCID', render: (_: unknown, row: { data: Record<string, unknown> }) => row.data.iccid ?? '-' },
                  { title: 'EPBIH IP', render: (_: unknown, row: { data: Record<string, unknown> }) => row.data.ipAddress ?? '-' },
                  { title: 'IP ADRESA', render: (_: unknown, row: { data: Record<string, unknown> }) => row.data.publicIpAddress ?? '-' },
                  { title: 'MSISDN', render: (_: unknown, row: { data: Record<string, unknown> }) => row.data.phoneNumber ?? '-' },
                  {
                    title: 'Greške',
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
