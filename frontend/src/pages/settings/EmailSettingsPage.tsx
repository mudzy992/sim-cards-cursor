import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Form, Input, Select, Space, Switch, Tabs, Typography, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { settingsApi } from '@/api/settings.api';
import { mailApi, type MailTemplate } from '@/api/mail.api';
import { useTranslation } from '@/i18n';

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
  const { t } = useTranslation();
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
      messageApi.success(t('emailSettings.smtp.saved'));
    },
    onError: (e: unknown) => {
      messageApi.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          t('emailSettings.smtp.saveFailed'),
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
            {t('emailSettings.smtp.title')}
          </Typography.Title>
          <Typography.Paragraph type="secondary" className="!mb-0">
            {t('emailSettings.smtp.intro')}
          </Typography.Paragraph>
        </div>

        <Form form={form} layout="vertical" onFinish={onSave}>
          <Space align="start" className="w-full justify-between" wrap>
            <Form.Item
              name="emailEnabled"
              label={t('emailSettings.smtp.emailEnabledLabel')}
              valuePropName="checked"
              className="min-w-[220px]"
            >
              <Switch checkedChildren={t('settings.enabled')} unCheckedChildren={t('settings.disabled')} />
            </Form.Item>

            <Form.Item name="provider" label={t('emailSettings.smtp.providerLabel')} rules={[{ required: true }]} className="min-w-[260px]">
              <Select
                options={[
                  { value: 'google', label: 'Google (Gmail)' },
                  { value: 'office365', label: 'Office 365' },
                  { value: 'exchange', label: t('emailSettings.smtp.providerExchange') },
                  { value: 'custom', label: t('emailSettings.smtp.providerCustom') },
                  { value: 'disabled', label: t('emailSettings.smtp.providerDisabled') },
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
            <Form.Item name="secure" label={t('emailSettings.smtp.secureLabel')} valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="requireTLS" label={t('emailSettings.smtp.requireTlsLabel')} valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>

          <Space className="w-full" size="large" wrap>
            <Form.Item name="user" label={t('common.labels.username')} className="min-w-[280px]">
              <Input placeholder="email@domain.com" />
            </Form.Item>
            <Form.Item name="pass" label={t('emailSettings.smtp.passwordLabel')} className="min-w-[280px]">
              <Input.Password placeholder="••••••••" />
            </Form.Item>
          </Space>

          <Space className="w-full" size="large" wrap>
            <Form.Item name="fromName" label={t('emailSettings.smtp.fromNameLabel')} className="min-w-[240px]">
              <Input placeholder="SIM Tracker" />
            </Form.Item>
            <Form.Item name="fromAddress" label={t('emailSettings.smtp.fromAddressLabel')} className="min-w-[280px]">
              <Input placeholder="no-reply@domain.com" />
            </Form.Item>
            <Form.Item name="replyTo" label={t('emailSettings.smtp.replyToLabel')} className="min-w-[280px]">
              <Input placeholder="" />
            </Form.Item>
          </Space>

          <Button type="primary" htmlType="submit" loading={saveMutation.isPending}>
            {t('common.actions.save')}
          </Button>
        </Form>
      </Space>
    </Card>
  );
}

function TemplatesCard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [messageApi, contextHolder] = message.useMessage();
  const [selected, setSelected] = useState<string>('installation-record-notification');
  const [content, setContent] = useState<string>('');
  const [previewHtml, setPreviewHtml] = useState<string>('');

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

  const sampleContext = useMemo(
    () => ({
      recordNumber: 'TEST-001',
      recordId: 'test',
    }),
    [],
  );

  const availableFields = useMemo(
    () => [
      { key: 'recordNumber', description: t('emailSettings.templates.fieldRecordNumber'), example: 'TEST-001' },
      { key: 'recordId', description: t('emailSettings.templates.fieldRecordId'), example: 'test' },
    ],
    [],
  );

  const previewMutation = useMutation({
    mutationFn: async () =>
      mailApi.previewTemplate(selected, sampleContext),
    onSuccess: (data) => setPreviewHtml(data.html),
    onError: (e: unknown) => {
      messageApi.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          t('emailSettings.templates.previewFailed'),
      );
    },
  });

  const saveTemplate = useMutation({
    mutationFn: async () => mailApi.updateTemplate(selected, content),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['mail', 'templates'] });
      messageApi.success(t('emailSettings.templates.saved'));
    },
    onError: (e: unknown) => {
      messageApi.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          t('emailSettings.templates.saveFailed'),
      );
    },
  });

  const testEmail = useMutation({
    mutationFn: async (to: string) =>
      mailApi.sendTest({
        to,
        template: selected,
        subject: `Test email (${selected})`,
        context: sampleContext,
      }),
    onSuccess: () => messageApi.success(t('emailSettings.templates.testSent')),
    onError: (e: unknown) => {
      messageApi.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          t('emailSettings.templates.testFailed'),
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
            {t('emailSettings.templates.title')}
          </Typography.Title>
          <Typography.Paragraph type="secondary" className="!mb-0">
            {t('emailSettings.templates.intro')}
          </Typography.Paragraph>
        </div>

        <Space wrap className="w-full justify-between">
          <Space wrap>
            <Select
              value={selected}
              onChange={(v) => {
                setSelected(String(v));
                setPreviewHtml('');
              }}
              options={(templatesQuery.data ?? []).map((t: MailTemplate) => ({
                value: t.name,
                label: `${t.name} (${t.sourceType})`,
              }))}
              style={{ minWidth: 360 }}
              loading={templatesQuery.isLoading}
            />
            <Button onClick={() => previewMutation.mutate()} loading={previewMutation.isPending}>
              {t('emailSettings.templates.preview')}
            </Button>
          </Space>
        </Space>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <Typography.Text type="secondary" className="block mb-2">
              {t('emailSettings.templates.editorLabel')}
            </Typography.Text>
            <Alert
              type="info"
              message={t('emailSettings.templates.availableFieldsTitle')}
              description={
                <div>
                  <div className="mb-2">
                    {t('emailSettings.templates.placeholderHint')} <code>{'{{field}}'}</code>
                  </div>
                  <ul className="list-disc ml-5">
                    {availableFields.map((f) => (
                      <li key={f.key}>
                        <code>{`{{${f.key}}}`}</code> — {f.description}{' '}
                        <Typography.Text type="secondary" className="font-mono">
                          ({t('emailSettings.templates.exampleLabel')} {String(f.example)})
                        </Typography.Text>
                      </li>
                    ))}
                  </ul>
                </div>
              }
              className="mb-3"
              showIcon
            />
            <Input.TextArea
              rows={18}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t('emailSettings.templates.editorPlaceholder')}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="primary" onClick={() => saveTemplate.mutate()} loading={saveTemplate.isPending}>
                {t('emailSettings.templates.saveTemplate')}
              </Button>
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
                {t('emailSettings.templates.sendTestEmail')}
              </Button>
            </div>
          </div>
          <div>
            <Typography.Text type="secondary" className="block mb-2">
              {t('emailSettings.templates.htmlPreview')}
            </Typography.Text>
            {previewHtml ? (
              <iframe
                title="template-preview"
                className="w-full min-h-[420px] rounded border"
                srcDoc={previewHtml}
              />
            ) : (
              <Alert
                type="info"
                message={t('emailSettings.templates.previewHint')}
              />
            )}
          </div>
        </div>
      </Space>
    </Card>
  );
}

export default function EmailSettingsPage() {
  const { t } = useTranslation();
  const { data: settings = [], isLoading } = useQuery<SettingRow[]>({
    queryKey: ['settings'],
    queryFn: () => settingsApi.list(),
  });

  const smtpProvider = getSetting(settings, 'smtp.provider') ?? 'custom';
  const missing = useMemo(() => {
    const required = ['smtp.provider', 'email.enabled'];
    const missingKeys = required.filter((k) => !settings.some((s) => s.key === k));
    const needsCreds = smtpProvider !== 'disabled' && (getSetting(settings, 'email.enabled') ?? 'true') === 'true';
    const hasUser = !!(getSetting(settings, 'smtp.user') ?? '').trim();
    const hasPass = !!(getSetting(settings, 'smtp.pass') ?? '').trim();
    if (needsCreds && (!hasUser || !hasPass)) {
      missingKeys.push('smtp.user/smtp.pass');
    }
    return missingKeys;
  }, [settings, smtpProvider]);

  return (
    <div className="space-y-4">
      <Typography.Title level={3} className="!mb-0">
        {t('emailSettings.title')}
      </Typography.Title>

      <Card className="mb-4">
        <Space align="start" className="w-full justify-between flex-wrap" size="middle">
          <Typography.Paragraph type="secondary" className="!mb-0 max-w-2xl">
            {t('emailSettings.pageIntro')}
          </Typography.Paragraph>
          <Button href="/settings">{t('emailSettings.backToSettings')}</Button>
        </Space>
      </Card>

      <Tabs
        items={[
          {
            key: 'smtp',
            label: 'SMTP',
            children: <SmtpWizardCard settings={settings} />,
          },
          {
            key: 'templates',
            label: t('emailSettings.templatesTab'),
            children: <TemplatesCard />,
          },
        ]}
      />

      {missing.length ? (
        <Alert
          type="warning"
          message={t('emailSettings.missingWarningTitle')}
          description={
            <div>
              <div>{t('emailSettings.checkFollowing')}</div>
              <ul className="list-disc ml-5">
                {missing.map((m) => (
                  <li key={m}>
                    <code>{m}</code>
                  </li>
                ))}
              </ul>
            </div>
          }
        />
      ) : null}

      {isLoading ? (
        <Typography.Text type="secondary">{t('emailSettings.loadingSettings')}</Typography.Text>
      ) : null}
    </div>
  );
}

