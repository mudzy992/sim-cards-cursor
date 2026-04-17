import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  Collapse,
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
import { useMemo, useState } from 'react';
import { useAuthStore } from '@/store/auth.store';

type SettingRow = {
  key: string;
  value: string;
  description?: string;
};

function getSettingValue(settings: SettingRow[], key: string): string | undefined {
  return settings.find((s) => s.key === key)?.value;
}

function SettingsNotificationsSection() {
  const queryClient = useQueryClient();
  const [messageApi, contextHolder] = message.useMessage();

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'notifications'],
    queryFn: () => settingsApi.getNotificationChannelSettings(),
  });

  const mutation = useMutation({
    mutationFn: (patch: {
      pushEnabled?: boolean;
      emailEnabled?: boolean;
      inAppEnabled?: boolean;
    }) => settingsApi.setNotificationChannelSettings(patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['settings', 'notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['settings', 'features'] });
      messageApi.success('Postavke su sačuvane.');
    },
    onError: (e: unknown) => {
      messageApi.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Greška pri spremanju postavke.',
      );
    },
  });

  const pushEnabled = data?.pushEnabled ?? true;
  const emailEnabled = data?.emailEnabled ?? true;
  const inAppEnabled = data?.inAppEnabled ?? true;

  return (
    <div>
      {contextHolder}
      <Space direction="vertical" size="large" className="w-full">
        <Typography.Paragraph type="secondary" className="!mb-0 max-w-3xl">
          Ove postavke su globalne (za sve korisnike). U offline/lokalnom režimu, push i email
          ne mogu raditi bez izlaza na internet — zato ih ovdje možeš sigurno isključiti.
        </Typography.Paragraph>

        <Space align="start" className="w-full justify-between">
          <div className="space-y-1 max-w-xl">
            <Typography.Text strong>Push notifikacije (mobile)</Typography.Text>
            <Typography.Paragraph type="secondary" className="!mb-0">
              Kada je isključeno, mobilne aplikacije neće tražiti odobrenje niti slati push tokene.
            </Typography.Paragraph>
          </div>
          <Switch
            checkedChildren="Uključeno"
            unCheckedChildren="Isključeno"
            loading={isLoading || mutation.isPending}
            checked={pushEnabled}
            onChange={(next) => {
              mutation.mutate({ pushEnabled: next });
            }}
          />
        </Space>

        <Divider className="!my-0" />

        <Space align="start" className="w-full justify-between">
          <div className="space-y-1 max-w-xl">
            <Typography.Text strong>Email notifikacije</Typography.Text>
            <Typography.Paragraph type="secondary" className="!mb-0">
              Kontroliše slanje email notifikacija iz sistema (ne mijenja SMTP konfiguraciju).
            </Typography.Paragraph>
          </div>
          <Switch
            checkedChildren="Uključeno"
            unCheckedChildren="Isključeno"
            loading={isLoading || mutation.isPending}
            checked={emailEnabled}
            onChange={(next) => {
              mutation.mutate({ emailEnabled: next });
            }}
          />
        </Space>

        <Divider className="!my-0" />

        <Space align="start" className="w-full justify-between">
          <div className="space-y-1 max-w-xl">
            <Typography.Text strong>In-app notifikacije</Typography.Text>
            <Typography.Paragraph type="secondary" className="!mb-0">
              Kontroliše kreiranje i emitovanje in-app notifikacija (web zvono i mobile inbox).
            </Typography.Paragraph>
          </div>
          <Switch
            checkedChildren="Uključeno"
            unCheckedChildren="Isključeno"
            loading={isLoading || mutation.isPending}
            checked={inAppEnabled}
            onChange={(next) => {
              mutation.mutate({ inAppEnabled: next });
            }}
          />
        </Space>
      </Space>
    </div>
  );
}

type SettingsGroup = {
  id: string;
  title: string;
  description?: string;
  keys: string[];
};

function SettingsKeyGroupCard(props: {
  title: string;
  description?: string;
  rows: SettingRow[];
  onEdit: (row: SettingRow) => void;
}) {
  const { title, description, rows, onEdit } = props;
  return (
    <Card title={title} className="mb-4">
      <Space direction="vertical" size="middle" className="w-full">
        {description ? (
          <Typography.Paragraph type="secondary" className="!mb-0 max-w-3xl">
            {description}
          </Typography.Paragraph>
        ) : null}
        <Table<SettingRow>
          dataSource={rows}
          rowKey="key"
          pagination={false}
          size="small"
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
              title: 'Vrijednost',
              dataIndex: 'value',
              width: 180,
              render: (v: SettingRow['value']) => {
                if (v === 'true' || v === 'false') {
                  return (
                    <Typography.Text className="font-mono text-sm">
                      {v === 'true' ? 'Uključeno' : 'Isključeno'}
                    </Typography.Text>
                  );
                }
                return <Typography.Text className="font-mono text-sm">{v}</Typography.Text>;
              },
            },
            {
              title: 'Akcije',
              width: 100,
              render: (_: unknown, record: SettingRow) => (
                <Button size="small" onClick={() => onEdit(record)}>
                  Uredi
                </Button>
              ),
            },
          ]}
        />
      </Space>
    </Card>
  );
}

export default function SettingsPage() {
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const [messageApi, contextHolder] = message.useMessage();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState('');
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

  const excludedFromSettingsPage = useMemo(() => {
    const prefixes = ['smtp.', 'email.templates.'];
    const exact = new Set<string>([
      'email.enabled',
      'email.fromName',
      'email.fromAddress',
      'email.replyTo',
    ]);

    return (key: string) => {
      if (exact.has(key)) return true;
      return prefixes.some((p) => key.startsWith(p));
    };
  }, []);

  const groups = useMemo<SettingsGroup[]>(
    () => [
      {
        id: 'mobile',
        title: 'Mobile',
        description: 'Postavke koje utiču na ponašanje mobilne aplikacije.',
        keys: [
          'mobile.offlineQueue.enabled',
          'mobile.offlineQueue.maxItems',
          'mobile.requireGpsForRecord',
          'mobile.push.testMode',
          'mobile.push.defaultChannel',
          'mobile.push.enabled',
        ],
      },
      {
        id: 'uploads',
        title: 'Upload',
        description: 'Limiti i allowed MIME tipovi za fotografije i dokumente.',
        keys: [
          'uploads.maxPhotoSizeMb',
          'uploads.allowedPhotoMimeTypes',
          'uploads.maxDocumentSizeMb',
          'uploads.allowedDocumentMimeTypes',
        ],
      },
      {
        id: 'security',
        title: 'Security / rate limit',
        description: 'Globalni throttling. Preporuka: uključen u produkciji.',
        keys: [
          'security.rateLimit.enabled',
          'security.rateLimit.windowSeconds',
          'security.rateLimit.maxRequests',
        ],
      },
      {
        id: 'dashboard',
        title: 'Dashboard',
        keys: ['dashboard.defaultTimeRange', 'dashboard.showDemountTasksWidget'],
      },
      {
        id: 'tour',
        title: 'Onboarding / tour',
        keys: ['tour.web.enabled', 'tour.mobile.enabled'],
      },
      {
        id: 'installationRecords',
        title: 'Zapisnici',
        keys: [
          'installationRecords.autoSubmitForApproval',
          'installationRecords.allowSelfApproval',
          'installationRecords.maxPhotosPerRecord',
          'installationRecords.requirePhotoForApproval',
        ],
      },
    ],
    [],
  );

  const groupedRows = useMemo(() => {
    const rowsByKey = new Map(settings.map((s) => [s.key, s] as const));
    const result = groups.map((g) => ({
      ...g,
      rows: g.keys.map((k) => rowsByKey.get(k)).filter(Boolean) as SettingRow[],
      missing: g.keys.filter((k) => !rowsByKey.has(k)),
    }));
    return result;
  }, [groups, settings]);

  const advancedRows = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return settings
      .filter((s) => !excludedFromSettingsPage(s.key))
      .filter((s) => {
        if (!normalized) return true;
        return (
          s.key.toLowerCase().includes(normalized) ||
          (s.description ?? '').toLowerCase().includes(normalized)
        );
      })
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [excludedFromSettingsPage, search, settings]);

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
      <Card title="Notifikacije" className="mb-4">
        <SettingsNotificationsSection />
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

      {groupedRows.map((g) =>
        g.rows.length ? (
          <SettingsKeyGroupCard
            key={g.id}
            title={g.title}
            description={g.description}
            rows={g.rows}
            onEdit={handleEdit}
          />
        ) : null,
      )}

      <Card title="Napredno (sve ostale postavke)" className="mb-4">
        <Space direction="vertical" className="w-full" size="middle">
          <Typography.Paragraph type="secondary" className="!mb-0 max-w-3xl">
            Ovdje su postavke koje nisu dio glavnih grupa. SMTP i email template-i su uklonjeni sa
            ove stranice jer se uređuju na posebnoj stranici.
          </Typography.Paragraph>
          <Input
            placeholder="Pretraga po ključu ili opisu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
          />
          <Collapse
            items={[
              {
                key: 'advanced',
                label: `Prikaži listu (${advancedRows.length})`,
                children: (
                  <Table<SettingRow>
                    dataSource={advancedRows}
                    rowKey="key"
                    loading={isLoading}
                    pagination={{ pageSize: 20, showSizeChanger: true }}
                    columns={[
                      {
                        title: 'Postavka',
                        dataIndex: 'description',
                        render: (_: string, record: SettingRow) => (
                          <div>
                            <Typography.Text strong>
                              {record.description || record.key}
                            </Typography.Text>
                            <Typography.Text
                              type="secondary"
                              className="block text-xs font-mono"
                            >
                              {record.key}
                            </Typography.Text>
                          </div>
                        ),
                      },
                      {
                        title: 'Vrijednost',
                        dataIndex: 'value',
                        width: 220,
                        render: (v: SettingRow['value']) => {
                          if (v === 'true' || v === 'false') {
                            return (
                              <Typography.Text className="font-mono text-sm">
                                {v === 'true' ? 'Uključeno' : 'Isključeno'}
                              </Typography.Text>
                            );
                          }
                          return (
                            <Typography.Text className="font-mono text-sm">{v}</Typography.Text>
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
                ),
              },
            ]}
          />
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
