import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  Drawer,
  Form,
  Input,
  Select,
  Space,
  Switch,
  Table,
  Typography,
  message,
  Divider,
} from 'antd';
import { settingsApi } from '@/api/settings.api';
import { useState } from 'react';
import { useAuthStore } from '@/store/auth.store';

type SettingRow = {
  key: string;
  value: string;
  description?: string;
};

function getSettingValue(settings: SettingRow[], key: string): string | undefined {
  return settings.find((s) => s.key === key)?.value;
}

function SettingsSmtpSection(props: { settings: SettingRow[] }) {
  const { settings } = props;
  const queryClient = useQueryClient();
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm();

  const update = useMutation({
    mutationFn: async (entries: { key: string; value: string }[]) => {
      for (const e of entries) {
        // eslint-disable-next-line no-await-in-loop
        await settingsApi.update(e.key, { value: e.value });
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
      messageApi.success('SMTP postavke su sačuvane.');
    },
    onError: (e: unknown) => {
      messageApi.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Greška pri spremanju SMTP postavki.',
      );
    },
  });

  const initialProvider = getSettingValue(settings, 'smtp.provider') ?? 'custom';
  const initialHost = getSettingValue(settings, 'smtp.host') ?? '';
  const initialPort = getSettingValue(settings, 'smtp.port') ?? '587';
  const initialSecure = getSettingValue(settings, 'smtp.secure') ?? 'false';
  const initialRequireTls = getSettingValue(settings, 'smtp.requireTLS') ?? 'true';
  const initialUser = getSettingValue(settings, 'smtp.user') ?? '';
  const initialPass = getSettingValue(settings, 'smtp.pass') ?? '';
  const initialFromName = getSettingValue(settings, 'smtp.fromName') ?? 'SIM Tracker';
  const initialFromAddress = getSettingValue(settings, 'smtp.fromAddress') ?? '';
  const initialReplyTo = getSettingValue(settings, 'smtp.replyTo') ?? '';

  return (
    <div>
      {contextHolder}
      <Typography.Paragraph type="secondary">
        SMTP postavke se čuvaju u bazi (app settings) i koriste se za slanje emailova iz backend-a.
        Google koristi App Password, Office365 tipično koristi STARTTLS (587).
      </Typography.Paragraph>

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          provider: initialProvider,
          host: initialHost,
          port: initialPort,
          secure: initialSecure === 'true',
          requireTLS: initialRequireTls === 'true',
          user: initialUser,
          pass: initialPass,
          fromName: initialFromName,
          fromAddress: initialFromAddress,
          replyTo: initialReplyTo,
        }}
        onFinish={(values) => {
          const entries: { key: string; value: string }[] = [
            { key: 'smtp.provider', value: String(values.provider ?? 'custom') },
            { key: 'smtp.host', value: String(values.host ?? '') },
            { key: 'smtp.port', value: String(values.port ?? '') },
            { key: 'smtp.secure', value: values.secure ? 'true' : 'false' },
            { key: 'smtp.requireTLS', value: values.requireTLS ? 'true' : 'false' },
            { key: 'smtp.user', value: String(values.user ?? '') },
            { key: 'smtp.pass', value: String(values.pass ?? '') },
            { key: 'smtp.fromName', value: String(values.fromName ?? '') },
            { key: 'smtp.fromAddress', value: String(values.fromAddress ?? '') },
            { key: 'smtp.replyTo', value: String(values.replyTo ?? '') },
          ];
          update.mutate(entries);
        }}
      >
        <Space direction="vertical" className="w-full">
          <Form.Item name="provider" label="Provider" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'google', label: 'Google (Gmail)' },
                { value: 'office365', label: 'Office 365' },
                { value: 'custom', label: 'Custom SMTP' },
                { value: 'disabled', label: 'Disabled (no email)' },
              ]}
            />
          </Form.Item>

          <Space className="w-full" size="large" wrap>
            <Form.Item name="host" label="Host" className="min-w-[260px]">
              <Input placeholder="smtp.gmail.com / smtp.office365.com / ..." />
            </Form.Item>
            <Form.Item name="port" label="Port" className="min-w-[140px]">
              <Input placeholder="587" />
            </Form.Item>
            <Form.Item name="secure" label="Secure (SMTPS)" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="requireTLS" label="Require TLS (STARTTLS)" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>

          <Space className="w-full" size="large" wrap>
            <Form.Item name="user" label="Username" className="min-w-[260px]">
              <Input placeholder="email@domain.com" />
            </Form.Item>
            <Form.Item name="pass" label="Password / App password" className="min-w-[260px]">
              <Input.Password placeholder="••••••••" />
            </Form.Item>
          </Space>

          <Space className="w-full" size="large" wrap>
            <Form.Item name="fromName" label="From name" className="min-w-[240px]">
              <Input placeholder="SIM Tracker" />
            </Form.Item>
            <Form.Item name="fromAddress" label="From address" className="min-w-[260px]">
              <Input placeholder="no-reply@domain.com" />
            </Form.Item>
            <Form.Item name="replyTo" label="Reply-To (optional)" className="min-w-[260px]">
              <Input placeholder="" />
            </Form.Item>
          </Space>

          <Button type="primary" htmlType="submit" loading={update.isPending}>
            Sačuvaj SMTP postavke
          </Button>
        </Space>
      </Form>
    </div>
  );
}

function SettingsMobilePushSection() {
  const queryClient = useQueryClient();
  const [messageApi, contextHolder] = message.useMessage();

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'mobile-push'],
    queryFn: () => settingsApi.getMobilePush(),
  });

  const mutation = useMutation({
    mutationFn: (enabled: boolean) => settingsApi.setMobilePush(enabled),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['settings', 'mobile-push'] });
      messageApi.success('Postavka je sačuvana.');
    },
    onError: (e: unknown) => {
      messageApi.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Greška pri spremanju postavke.',
      );
    },
  });

  const enabled = data?.enabled ?? true;

  return (
    <div>
      {contextHolder}
      <Space align="start" className="w-full justify-between">
        <div className="space-y-1 max-w-xl">
          <Typography.Text strong>Dozvoli mobilne push notifikacije</Typography.Text>
          <Typography.Paragraph type="secondary" className="!mb-0">
            Kada je ova opcija isključena, mobilne aplikacije neće tražiti odobrenje za
            notifikacije niti će slati push tokene prema serveru. Ovo je preporučeno za
            zatvorena/offline okruženja bez pristupa internetu.
          </Typography.Paragraph>
        </div>
        <Switch
          checkedChildren="Uključeno"
          unCheckedChildren="Isključeno"
          loading={isLoading || mutation.isPending}
          checked={enabled}
          onChange={(next) => {
            mutation.mutate(next);
          }}
        />
      </Space>
    </div>
  );
}

export default function SettingsPage() {
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const [messageApi, contextHolder] = message.useMessage();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  useAuthStore((s) => s.user);

  const { data: settings = [], isLoading } = useQuery<SettingRow[]>({
    queryKey: ['settings'],
    queryFn: () => settingsApi.list(),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      key,
      data,
    }: {
      key: string;
      data: { value: string; description?: string };
    }) => settingsApi.update(key, data),
    onSuccess: () => {
      messageApi.success('Postavka je ažurirana.');
      setEditingKey(null);
      setDrawerOpen(false);
      form.resetFields();
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (e: unknown) => {
      messageApi.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Greška',
      );
    },
  });

  const handleEdit = (record: { key: string; value: string; description?: string }) => {
    setEditingKey(record.key);
    form.setFieldsValue({
      value:
        record.value === 'true'
          ? true
          : record.value === 'false'
          ? false
          : record.value,
      description: record.description,
    });
    setDrawerOpen(true);
  };

  const handleSubmit = (values: { value: string | boolean; description?: string }) => {
    if (editingKey) {
      const current = settings.find((s) => s.key === editingKey);
      const isBooleanValue =
        current && (current.value === 'true' || current.value === 'false');

      const normalizedValue = isBooleanValue
        ? (values.value ? 'true' : 'false')
        : String(values.value ?? '');

      updateMutation.mutate({
        key: editingKey,
        data: {
          value: normalizedValue,
          description: values.description,
        },
      });
    }
  };

  return (
    <div
      className="space-y-4"
      data-tour-id="admin-settings"
      data-tour-role="SYSTEM_ADMIN"
    >
      {contextHolder}
      <Typography.Title level={3} className="!mb-0">
        Postavke aplikacije
      </Typography.Title>
      <Card className="mb-4">
        <Table<SettingRow>
          dataSource={settings}
          rowKey="key"
          loading={isLoading}
          pagination={false}
          columns={[
            {
              title: 'Postavka',
              dataIndex: 'description',
              render: (_: string, record: SettingRow) => (
                <div>
                  <Typography.Text strong>
                    {record.description || record.key}
                  </Typography.Text>
                  <Typography.Text type="secondary" className="block text-xs font-mono">
                    {record.key}
                  </Typography.Text>
                </div>
              ),
            },
            {
              title: 'Trenutna vrijednost',
              dataIndex: 'value',
              render: (v: SettingRow['value']) => {
                if (v === 'true' || v === 'false') {
                  return (
                    <Typography.Text className="font-mono text-sm">
                      {v === 'true' ? 'Uključeno' : 'Isključeno'}
                    </Typography.Text>
                  );
                }
                return (
                  <Typography.Text className="font-mono text-sm">
                    {v}
                  </Typography.Text>
                );
              },
            },
            {
              title: 'Akcije',
              width: 100,
              render: (_: unknown, record: SettingRow) => (
                <Button size="small" onClick={() => handleEdit(record)}>
                  Uredi
                </Button>
              ),
            },
          ]}
        />
      </Card>

      <Card title="Mobilne push notifikacije" className="mb-4">
        <SettingsMobilePushSection />
      </Card>

      <Card title="Email / SMTP" className="mb-4">
        <Space align="start" className="w-full justify-between" wrap>
          <Typography.Paragraph type="secondary" className="!mb-0 max-w-2xl">
            Email (SMTP) postavke i template-i su prebačeni na posebnu stranicu radi lakšeg podešavanja.
          </Typography.Paragraph>
          <Button type="primary" href="/settings/email">
            Otvori Email postavke
          </Button>
        </Space>
      </Card>

      <Drawer
        title={`Uredi postavku: ${editingKey}`}
        open={drawerOpen}
        width={520}
        onClose={() => {
          setDrawerOpen(false)
          setEditingKey(null)
          form.resetFields()
        }}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          {(() => {
            const current = settings.find((s) => s.key === editingKey);
            return current?.description ? (
              <Typography.Paragraph type="secondary">
                {current.description}
              </Typography.Paragraph>
            ) : null;
          })()}
          {(() => {
            const current = settings.find((s) => s.key === editingKey);
            const key = current?.key ?? '';
            const rawValue = current?.value ?? '';
            const isBoolean = rawValue === 'true' || rawValue === 'false';

            if (isBoolean) {
              return (
                <Form.Item
                  name="value"
                  label="Vrijednost"
                  valuePropName="checked"
                  rules={[{ required: true }]}
                >
                  <Switch checkedChildren="Uključeno" unCheckedChildren="Isključeno" />
                </Form.Item>
              );
            }

            if (key === 'dashboard.defaultTimeRange') {
              return (
                <Form.Item
                  name="value"
                  label="Podrazumijevani vremenski opseg"
                  rules={[{ required: true }]}
                >
                  <Select
                    options={[
                      { value: 'TODAY', label: 'Danas' },
                      { value: '7_DAYS', label: 'Posljednjih 7 dana' },
                      { value: '30_DAYS', label: 'Posljednjih 30 dana' },
                    ]}
                  />
                </Form.Item>
              );
            }

            if (key === 'mobile.push.defaultChannel') {
              return (
                <Form.Item
                  name="value"
                  label="Podrazumijevani push kanal"
                  rules={[{ required: true }]}
                >
                  <Select
                    options={[
                      { value: 'approval', label: 'Approval' },
                      { value: 'records', label: 'Records' },
                      { value: 'system', label: 'System' },
                    ]}
                  />
                </Form.Item>
              );
            }

            return (
              <Form.Item
                name="value"
                label="Vrijednost"
                rules={[{ required: true }]}
              >
                <Input.TextArea rows={3} />
              </Form.Item>
            );
          })()}
          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={updateMutation.isPending}
              >
                Sačuvaj
              </Button>
              <Button
                onClick={() => {
                  setDrawerOpen(false);
                  setEditingKey(null);
                }}
              >
                Odustani
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}
