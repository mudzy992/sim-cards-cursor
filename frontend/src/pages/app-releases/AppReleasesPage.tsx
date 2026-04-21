import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Form, Input, InputNumber, Space, Table, Typography, Upload, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { UploadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { appReleasesApi, type MobileAppRelease } from '@/api/app-releases.api';
import { API_BASE_URL } from '@/api/axios.instance';

export default function AppReleasesPage() {
  const queryClient = useQueryClient();
  const [form] = Form.useForm<{
    versionName: string;
    versionCode: number;
    releaseNotes?: string;
    file?: File;
  }>();

  const { data: releases = [], isLoading } = useQuery({
    queryKey: ['app-releases', 'android'],
    queryFn: () => appReleasesApi.listAndroid(),
  });

  const uploadMutation = useMutation({
    mutationFn: async (values: {
      versionName: string;
      versionCode: number;
      releaseNotes?: string;
      file: File;
    }) => appReleasesApi.uploadAndroid(values),
    onSuccess: async () => {
      message.success('Nova verzija je uploadovana.');
      await queryClient.invalidateQueries({ queryKey: ['app-releases', 'android'] });
      form.resetFields();
    },
    onError: (e: unknown) => {
      const msg =
        (e as any)?.response?.data?.message ??
        (e as Error).message ??
        'Greška pri uploadu verzije.';
      message.error(msg);
    },
  });

  const columns: ColumnsType<MobileAppRelease> = [
    {
      title: 'Verzija',
      dataIndex: 'versionName',
      key: 'versionName',
      render: (v: string) => <Typography.Text strong>{v}</Typography.Text>,
    },
    {
      title: 'Verzijski kod (Android)',
      dataIndex: 'versionCode',
      key: 'versionCode',
      width: 120,
    },
    {
      title: 'Objavljeno',
      dataIndex: 'publishedAt',
      key: 'publishedAt',
      width: 200,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: 'Obavezno nakon',
      dataIndex: 'mandatoryAfterAt',
      key: 'mandatoryAfterAt',
      width: 200,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: 'APK',
      dataIndex: 'apkFileName',
      key: 'apkFileName',
      render: (v: string) => (
        <Typography.Text type="secondary" className="text-xs">
          {v}
        </Typography.Text>
      ),
    },
    {
      title: 'Download',
      key: 'download',
      width: 140,
      render: (_, record) => (
        <a
          href={`${API_BASE_URL}/app-releases/android/download/${record.id}`}
          target="_blank"
          rel="noreferrer"
        >
          Preuzmi .apk
        </a>
      ),
    },
  ];

  const latest = releases[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Typography.Title level={3} className="!mb-1">
            App verzije (Android)
          </Typography.Title>
          <Typography.Text type="secondary">
            Upravljanje verzijama mobilne aplikacije (.apk). Nova verzija će biti ponuđena
            korisnicima nakon upload-a (sa 7 dana grace periodom prije force update-a).
          </Typography.Text>
        </div>
      </div>

      {latest && (
        <div className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3">
          <Typography.Text strong>Aktivna (zadnja) verzija:</Typography.Text>{' '}
          <Typography.Text>
            {latest.versionName} (code: {latest.versionCode}) – objavljena{' '}
            {dayjs(latest.publishedAt).format('YYYY-MM-DD HH:mm')}
          </Typography.Text>
        </div>
      )}

      <Table
        rowKey="id"
        loading={isLoading}
        columns={columns}
        dataSource={releases}
        pagination={false}
        size="middle"
        scroll={{ x: 'max-content' }}
      />

      <div className="mt-8 max-w-xl">
        <Typography.Title level={4} className="!mb-3">
          Upload nove verzije (.apk)
        </Typography.Title>
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => {
            const fileList = (values as any).file as { originFileObj?: File }[] | undefined;
            const first = fileList && fileList[0]?.originFileObj;
            if (!first) {
              message.error('Odaberite .apk fajl.');
              return;
            }
            uploadMutation.mutate({
              versionName: values.versionName,
              versionCode: values.versionCode,
              releaseNotes: values.releaseNotes,
              file: first,
            });
          }}
        >
          <Form.Item
            name="versionName"
            label="Verzija (npr. 1.2.3)"
            rules={[{ required: true }]}
          >
            <Input placeholder="1.2.3" />
          </Form.Item>
          <Form.Item
            name="versionCode"
            label="Verzijski kod (cijeli broj)"
            rules={[{ required: true }]}
          >
            <InputNumber className="w-full" min={1} />
          </Form.Item>
          <Form.Item name="releaseNotes" label="Napomene uz verziju (opciono)">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item
            name="file"
            label="APK fajl"
            valuePropName="fileList"
            rules={[{ required: true, message: 'Potrebno je uploadovati .apk fajl.' }]}
            getValueFromEvent={(e) => {
              // AntD Upload šalje event koji sadrži fileList; ovdje ga normalizujemo u niz.
              if (Array.isArray(e)) return e;
              return e?.fileList ?? [];
            }}
          >
            <Upload
              beforeUpload={(file) => {
                if (!file.name.toLowerCase().endsWith('.apk')) {
                  message.error('Dozvoljeni su samo .apk fajlovi.');
                  return Upload.LIST_IGNORE;
                }
                // Vrati false da spriječimo automatski upload; fajl ide kroz FormData u onFinish.
                return false;
              }}
              maxCount={1}
              showUploadList={{ showRemoveIcon: true }}
            >
              <Button icon={<UploadOutlined />}>Odaberi .apk fajl</Button>
            </Upload>
          </Form.Item>
          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={uploadMutation.isPending}
              >
                Snimi verziju
              </Button>
              <Button
                onClick={() => {
                  form.resetFields();
                }}
              >
                Očisti formu
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
}
