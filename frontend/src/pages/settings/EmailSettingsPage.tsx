import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Form, Input, Select, Space, Switch, Tabs, Typography, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { settingsApi } from '@/api/settings.api';
import { mailApi, type MailTemplate } from '@/api/mail.api';

type SettingRow = { key: string; value: string; description?: string };

function getSetting(settings: SettingRow[], key: string): string | undefined {
  return settings.find((s) => s.key === key)?.value;
}

const SMTP_PRESETS: Record<
  string,
  { host: string; port: string; secure: boolean; requireTLS: boolean }
> = {
  google: { host: 'smtp.gmail.com', port: '465', secure: true, requireTLS: true },
  office365: { host: 'smtp.office365.com', port: '587', secure: false, requireTLS: true },
  exchange: { host: '', port: '587', secure: false, requireTLS: true },
  custom: { host: '', port: '587', secure: false, requireTLS: false },
  disabled: { host: '', port: '587', secure: false, requireTLS: false },
};

function SmtpWizardCard(props: { settings: SettingRow[] }) {
  const { settings } = props;
  const queryClient = useQueryClient();
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm();

  const initialProvider = getSetting(settings, 'smtp.provider') ?? 'custom';
  const initialValues = useMemo(
    () => ({
      provider: initialProvider,
      host: getSetting(settings, 'smtp.host') ?? '',
      port: getSetting(settings, 'smtp.port') ?? '587',
      secure: (getSetting(settings, 'smtp.secure') ?? 'false') === 'true',
      requireTLS: (getSetting(settings, 'smtp.requireTLS') ?? 'true') === 'true',
      user: getSetting(settings, 'smtp.user') ?? '',
      pass: getSetting(settings, 'smtp.pass') ?? '',
      fromName: getSetting(settings, 'smtp.fromName') ?? 'SIM Tracker',
      fromAddress: getSetting(settings, 'smtp.fromAddress') ?? '',
      replyTo: getSetting(settings, 'smtp.replyTo') ?? '',
      emailEnabled: (getSetting(settings, 'email.enabled') ?? 'true') === 'true',
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings],
  );

  useEffect(() => {
    form.setFieldsValue(initialValues);
  }, [form, initialValues]);

  const saveMutation = useMutation({
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
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Greška pri spremanju SMTP postavki.',
      );
    },
  });

  const applyPreset = (provider: string) => {
    const preset = SMTP_PRESETS[provider] ?? SMTP_PRESETS.custom;
    form.setFieldsValue({
      host: preset.host,
      port: preset.port,
      secure: preset.secure,
      requireTLS: preset.requireTLS,
    });
  };

  const onSave = (values: Record<string, unknown>) => {
    const entries: { key: string; value: string }[] = [
      { key: 'email.enabled', value: values.emailEnabled ? 'true' : 'false' },
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
    saveMutation.mutate(entries);
  };

  return (
    <Card>
      {contextHolder}
      <Space direction="vertical" className="w-full" size="large">
        <div>
          <Typography.Title level={4} className="!mb-1">
            SMTP / Email transport
          </Typography.Title>
          <Typography.Paragraph type="secondary" className="!mb-0">
            Odaberi provider, primijeni preset i unesi kredencijale. Za Google koristi App Password. Za Office365 STARTTLS (587).
          </Typography.Paragraph>
        </div>

        <Form form={form} layout="vertical" onFinish={onSave}>
          <Space align="start" className="w-full justify-between" wrap>
            <Form.Item
              name="emailEnabled"
              label="Email enabled"
              valuePropName="checked"
              className="min-w-[220px]"
            >
              <Switch checkedChildren="Uključeno" unCheckedChildren="Isključeno" />
            </Form.Item>

            <Form.Item name="provider" label="Provider" rules={[{ required: true }]} className="min-w-[260px]">
              <Select
                options={[
                  { value: 'google', label: 'Google (Gmail)' },
                  { value: 'office365', label: 'Office 365' },
                  { value: 'exchange', label: 'Exchange (custom host)' },
                  { value: 'custom', label: 'Custom SMTP' },
                  { value: 'disabled', label: 'Disabled (no email)' },
                ]}
                onChange={(v) => applyPreset(String(v))}
              />
            </Form.Item>
          </Space>

          <Space className="w-full" size="large" wrap>
            <Form.Item name="host" label="Host" className="min-w-[280px]">
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
            <Form.Item name="user" label="Username" className="min-w-[280px]">
              <Input placeholder="email@domain.com" />
            </Form.Item>
            <Form.Item name="pass" label="Password / App password" className="min-w-[280px]">
              <Input.Password placeholder="••••••••" />
            </Form.Item>
          </Space>

          <Space className="w-full" size="large" wrap>
            <Form.Item name="fromName" label="From name" className="min-w-[240px]">
              <Input placeholder="SIM Tracker" />
            </Form.Item>
            <Form.Item name="fromAddress" label="From address" className="min-w-[280px]">
              <Input placeholder="no-reply@domain.com" />
            </Form.Item>
            <Form.Item name="replyTo" label="Reply-To (optional)" className="min-w-[280px]">
              <Input placeholder="" />
            </Form.Item>
          </Space>

          <Button type="primary" htmlType="submit" loading={saveMutation.isPending}>
            Sačuvaj
          </Button>
        </Form>
      </Space>
    </Card>
  );
}

function TemplatesCard() {
  const queryClient = useQueryClient();
  const [messageApi, contextHolder] = message.useMessage();
  const [selected, setSelected] = useState<string>('installation-record-approval-request');
  const [content, setContent] = useState<string>('');

  const templatesQuery = useQuery({
    queryKey: ['mail', 'templates'],
    queryFn: () => mailApi.listTemplates(),
  });

  const currentTemplate = useMemo(() => {
    const list = templatesQuery.data ?? [];
    return list.find((t) => t.name === selected) ?? null;
  }, [templatesQuery.data, selected]);

  useEffect(() => {
    if (currentTemplate) {
      setContent(currentTemplate.content);
    }
  }, [currentTemplate]);

  const saveTemplate = useMutation({
    mutationFn: async () => mailApi.updateTemplate(selected, content),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['mail', 'templates'] });
      messageApi.success('Template je sačuvan (DB override).');
    },
    onError: (e: unknown) => {
      messageApi.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Greška pri spremanju template-a.',
      );
    },
  });

  const testEmail = useMutation({
    mutationFn: async (to: string) =>
      mailApi.sendTest({
        to,
        template: selected,
        subject: `Test email (${selected})`,
        context: {
          recordNumber: 'TEST-001',
          recordId: 'test',
          meterSerialNumber: 'M-123',
          ipAddress: '10.0.0.1',
          installationAddress: 'Test adresa 1',
          municipality: 'Test općina',
          installedByName: 'System Admin',
          appUrl: window.location.origin,
        },
      }),
    onSuccess: () => messageApi.success('Test email poslan (ako je SMTP ispravno podešen).'),
    onError: (e: unknown) => {
      messageApi.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Greška pri slanju test emaila.',
      );
    },
  });

  const [testTo, setTestTo] = useState('');

  return (
    <Card>
      {contextHolder}
      <Space direction="vertical" className="w-full" size="large">
        <div>
          <Typography.Title level={4} className="!mb-1">
            Email template-i
          </Typography.Title>
          <Typography.Paragraph type="secondary" className="!mb-0">
            Template-i su Handlebars (.hbs). Ako sačuvaš ovdje, sadržaj se čuva u bazi kao override; ako nije sačuvano, koristi se default iz fajla.
          </Typography.Paragraph>
        </div>

        <Space wrap className="w-full justify-between">
          <Select
            value={selected}
            onChange={(v) => setSelected(String(v))}
            options={(templatesQuery.data ?? []).map((t: MailTemplate) => ({
              value: t.name,
              label: `${t.name} (${t.sourceType})`,
            }))}
            style={{ minWidth: 320 }}
            loading={templatesQuery.isLoading}
          />
          <Space wrap>
            <Input
              placeholder="test@email.com"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              style={{ width: 260 }}
            />
            <Button
              onClick={() => testEmail.mutate(testTo)}
              loading={testEmail.isPending}
              disabled={!testTo.trim()}
            >
              Pošalji test email
            </Button>
            <Button type="primary" onClick={() => saveTemplate.mutate()} loading={saveTemplate.isPending}>
              Sačuvaj template
            </Button>
          </Space>
        </Space>

        <Input.TextArea
          rows={18}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="(Handlebars template)"
        />
      </Space>
    </Card>
  );
}

export default function EmailSettingsPage() {
  const { data: settings = [], isLoading } = useQuery<SettingRow[]>({
    queryKey: ['settings'],
    queryFn: () => settingsApi.list(),
  });

  return (
    <div className="space-y-4">
      <Typography.Title level={3} className="!mb-0">
        Email postavke
      </Typography.Title>

      <Tabs
        items={[
          {
            key: 'smtp',
            label: 'SMTP',
            children: <SmtpWizardCard settings={settings} />,
          },
          {
            key: 'templates',
            label: 'Template-i',
            children: <TemplatesCard />,
          },
        ]}
      />

      {isLoading ? (
        <Typography.Text type="secondary">Učitavanje postavki…</Typography.Text>
      ) : null}
    </div>
  );
}

