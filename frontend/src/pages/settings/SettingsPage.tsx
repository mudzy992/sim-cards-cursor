import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  Collapse,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Typography,
  message,
} from 'antd';
import { settingsApi } from '@/api/settings.api';
import { useMemo, useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import {
  APP_SETTINGS_MANIFEST,
  MANIFEST_GROUP_ORDER,
  MANIFEST_KEYS,
  type AppSettingManifestEntry,
  type AppSettingValueType,
} from '@/config/app-settings.manifest';

type SettingRow = {
  key: string;
  value: string;
  description?: string;
};

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

        <div className="border-t border-neutral-200 dark:border-neutral-700" />

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

        <div className="border-t border-neutral-200 dark:border-neutral-700" />

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

function guessLegacyValueType(row: SettingRow): AppSettingValueType {
  const v = row.value;
  if (v === 'true' || v === 'false') return 'boolean';
  if (/^\d+(\.\d+)?$/.test(String(v).trim())) return 'number';
  return 'string';
}

type ManifestGroupCardProps = {
  groupId: string;
  title: string;
  description?: string;
  entries: AppSettingManifestEntry[];
  settingsByKey: Map<string, SettingRow>;
  pendingKey: string | null;
  onBooleanChange: (row: SettingRow, entry: AppSettingManifestEntry, next: boolean) => void;
  onOpenEdit: (row: SettingRow, entry: AppSettingManifestEntry) => void;
};

function ManifestGroupCard(props: ManifestGroupCardProps) {
  const {
    title,
    description,
    entries,
    settingsByKey,
    pendingKey,
    onBooleanChange,
    onOpenEdit,
  } = props;

  const rows = entries
    .map((entry) => {
      const row = settingsByKey.get(entry.key);
      return row ? { entry, row } : null;
    })
    .filter(Boolean) as { entry: AppSettingManifestEntry; row: SettingRow }[];

  if (!rows.length) {
    return null;
  }

  return (
    <Card title={title} className="mb-4">
      <Space direction="vertical" size="middle" className="w-full">
        {description ? (
          <Typography.Paragraph type="secondary" className="!mb-0 max-w-3xl">
            {description}
          </Typography.Paragraph>
        ) : null}
        <Table
          dataSource={rows}
          rowKey={(r) => r.entry.key}
          pagination={false}
          size="small"
          columns={[
            {
              title: 'Postavka',
              render: (_, r) => (
                <div>
                  <Typography.Text strong>{r.entry.label}</Typography.Text>
                  <Typography.Paragraph type="secondary" className="!mb-0 text-sm max-w-2xl">
                    {r.entry.description}
                  </Typography.Paragraph>
                  <Typography.Text type="secondary" className="block text-xs font-mono">
                    {r.entry.key}
                  </Typography.Text>
                </div>
              ),
            },
            {
              title: 'Vrijednost',
              width: 200,
              align: 'right',
              render: (_, r) => {
                if (r.entry.valueType === 'boolean') {
                  return (
                    <Switch
                      checkedChildren="Da"
                      unCheckedChildren="Ne"
                      checked={r.row.value === 'true'}
                      loading={pendingKey === r.entry.key}
                      onChange={(checked) => onBooleanChange(r.row, r.entry, checked)}
                    />
                  );
                }
                const display =
                  r.entry.valueType === 'enum' && r.entry.enumOptions
                    ? r.entry.enumOptions.find((o) => o.value === r.row.value)?.label ?? r.row.value
                    : r.entry.valueType === 'secret'
                      ? r.row.value
                        ? '••••••••'
                        : '—'
                      : r.row.value;
                return <Typography.Text className="font-mono text-sm">{display}</Typography.Text>;
              },
            },
            {
              title: '',
              width: 100,
              align: 'right',
              render: (_, r) =>
                r.entry.valueType === 'boolean' ? null : (
                  <Button size="small" type="link" onClick={() => onOpenEdit(r.row, r.entry)}>
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
  const [manifestForm] = Form.useForm();
  const [legacyForm] = Form.useForm();
  const queryClient = useQueryClient();
  const [messageApi, contextHolder] = message.useMessage();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalEntry, setModalEntry] = useState<AppSettingManifestEntry | null>(null);
  const [modalRow, setModalRow] = useState<SettingRow | null>(null);
  const [legacyModalOpen, setLegacyModalOpen] = useState(false);
  const [legacyRow, setLegacyRow] = useState<SettingRow | null>(null);
  const [search, setSearch] = useState('');
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  useAuthStore((s) => s.user);

  const { data: settings = [], isLoading } = useQuery<SettingRow[]>({
    queryKey: ['settings'],
    queryFn: () => settingsApi.list(),
  });

  const settingsByKey = useMemo(() => new Map(settings.map((s) => [s.key, s] as const)), [settings]);

  const updateMutation = useMutation({
    mutationFn: (args: { key: string; data: { value: string; description?: string } }) =>
      settingsApi.update(args.key, args.data),
    onMutate: ({ key }) => setPendingKey(key),
    onSuccess: () => {
      messageApi.success('Postavka je ažurirana.');
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
      void queryClient.invalidateQueries({ queryKey: ['settings', 'features'] });
      setModalOpen(false);
      setLegacyModalOpen(false);
      setModalEntry(null);
      setModalRow(null);
      setLegacyRow(null);
      manifestForm.resetFields();
      legacyForm.resetFields();
    },
    onError: (e: unknown) => {
      messageApi.error(
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Greška',
      );
    },
    onSettled: () => setPendingKey(null),
  });

  const excludedFromSettingsPage = useMemo(() => {
    const prefixes = ['smtp.', 'email.templates.'];
    const exact = new Set<string>(['email.enabled']);

    return (key: string) => {
      if (exact.has(key)) return true;
      return prefixes.some((p) => key.startsWith(p));
    };
  }, []);

  const manifestGroups = useMemo(() => {
    const byGroup = new Map<string, AppSettingManifestEntry[]>();
    APP_SETTINGS_MANIFEST.forEach((e) => {
      if (!byGroup.has(e.groupId)) {
        byGroup.set(e.groupId, []);
      }
      byGroup.get(e.groupId)!.push(e);
    });
    return MANIFEST_GROUP_ORDER.map((groupId) => {
      const entries = byGroup.get(groupId) ?? [];
      const first = entries[0];
      return {
        groupId,
        title: first?.groupTitle ?? groupId,
        description: first?.groupDescription,
        entries,
      };
    });
  }, []);

  const handleBooleanChange = (row: SettingRow, entry: AppSettingManifestEntry, next: boolean) => {
    const apply = () => {
      updateMutation.mutate({
        key: row.key,
        data: { value: next ? 'true' : 'false', description: row.description },
      });
    };
    if (entry.confirmDangerousChange && !next) {
      Modal.confirm({
        title: entry.confirmDangerousChange.title,
        content: entry.confirmDangerousChange.content,
        okText: 'Isključi',
        okButtonProps: { danger: true },
        cancelText: 'Odustani',
        onOk: apply,
      });
      return;
    }
    apply();
  };

  const openManifestModal = (row: SettingRow, entry: AppSettingManifestEntry) => {
    setModalEntry(entry);
    setModalRow(row);
    const vt = entry.valueType;
    if (vt === 'number') {
      manifestForm.setFieldsValue({
        value: Number(row.value) || 0,
        description: row.description,
      });
    } else if (vt === 'enum') {
      manifestForm.setFieldsValue({
        value: row.value,
        description: row.description,
      });
    } else if (vt === 'secret') {
      manifestForm.setFieldsValue({
        value: row.value,
        description: row.description,
      });
    } else {
      manifestForm.setFieldsValue({
        value: row.value,
        description: row.description,
      });
    }
    setModalOpen(true);
  };

  const handleModalSubmit = () => {
    void manifestForm.validateFields().then((values) => {
      const key = modalEntry?.key ?? modalRow?.key;
      if (!key || !modalEntry) return;
      let out = '';
      if (modalEntry.valueType === 'number') {
        out = String(values.value ?? '');
      } else if (modalEntry.valueType === 'enum') {
        out = String(values.value ?? '');
      } else if (modalEntry.valueType === 'secret') {
        out = String(values.value ?? '');
      } else {
        out = String(values.value ?? '');
      }
      updateMutation.mutate({
        key,
        data: {
          value: out,
          description: values.description ?? modalRow?.description,
        },
      });
    });
  };

  const openLegacyModal = (row: SettingRow) => {
    setLegacyRow(row);
    const t = guessLegacyValueType(row);
    if (t === 'boolean') {
      legacyForm.setFieldsValue({
        value: row.value === 'true',
        description: row.description,
      });
    } else if (t === 'number') {
      legacyForm.setFieldsValue({
        value: Number(row.value),
        description: row.description,
      });
    } else {
      legacyForm.setFieldsValue({
        value: row.value,
        description: row.description,
      });
    }
    setLegacyModalOpen(true);
  };

  const handleLegacySubmit = () => {
    void legacyForm.validateFields().then((values) => {
      if (!legacyRow) return;
      const t = guessLegacyValueType(legacyRow);
      let out = '';
      if (t === 'boolean') {
        out = values.value ? 'true' : 'false';
      } else if (t === 'number') {
        out = String(values.value ?? '');
      } else {
        out = String(values.value ?? '');
      }
      updateMutation.mutate({
        key: legacyRow.key,
        data: {
          value: out,
          description: values.description ?? legacyRow.description,
        },
      });
    });
  };

  const advancedRows = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return settings
      .filter((s) => !excludedFromSettingsPage(s.key))
      .filter((s) => !MANIFEST_KEYS.has(s.key))
      .filter((s) => {
        if (!normalized) return true;
        return (
          s.key.toLowerCase().includes(normalized) ||
          (s.description ?? '').toLowerCase().includes(normalized)
        );
      })
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [excludedFromSettingsPage, search, settings]);

  const renderModalFormFields = (entry: AppSettingManifestEntry) => {
    if (entry.valueType === 'number') {
      return (
        <Form.Item
          name="value"
          label={entry.label}
          rules={[{ required: true, type: 'number', min: 0 }]}
        >
          <InputNumber className="w-full max-w-md" min={0} />
        </Form.Item>
      );
    }
    if (entry.valueType === 'enum' && entry.enumOptions) {
      return (
        <Form.Item name="value" label={entry.label} rules={[{ required: true }]}>
          <Select options={entry.enumOptions} />
        </Form.Item>
      );
    }
    if (entry.valueType === 'secret') {
      return (
        <Form.Item name="value" label={entry.label} rules={[{ required: true }]}>
          <Input.Password autoComplete="new-password" />
        </Form.Item>
      );
    }
    return (
      <Form.Item name="value" label={entry.label} rules={[{ required: true }]}>
        <Input.TextArea rows={4} />
      </Form.Item>
    );
  };

  const renderLegacyModalFields = () => {
    if (!legacyRow) return null;
    const t = guessLegacyValueType(legacyRow);
    if (t === 'boolean') {
      return (
        <Form.Item name="value" label="Vrijednost" valuePropName="checked">
          <Switch checkedChildren="Uključeno" unCheckedChildren="Isključeno" />
        </Form.Item>
      );
    }
    if (t === 'number') {
      return (
        <Form.Item name="value" label="Vrijednost" rules={[{ required: true, type: 'number' }]}>
          <InputNumber className="w-full max-w-md" />
        </Form.Item>
      );
    }
    return (
      <Form.Item name="value" label="Vrijednost" rules={[{ required: true }]}>
        <Input.TextArea rows={4} />
      </Form.Item>
    );
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
      <Card title="Notifikacije" className="mb-4">
        <SettingsNotificationsSection />
      </Card>

      <Card title="Email / SMTP" className="mb-4">
        <Space align="start" className="w-full justify-between" wrap>
          <Typography.Paragraph type="secondary" className="!mb-0 max-w-2xl">
            Email (SMTP) postavke i template-i su na posebnoj stranici radi lakšeg podešavanja.
          </Typography.Paragraph>
          <Button type="primary" href="/settings/email">
            Otvori Email postavke
          </Button>
        </Space>
      </Card>

      {manifestGroups.map((g) => (
        <ManifestGroupCard
          key={g.groupId}
          groupId={g.groupId}
          title={g.title}
          description={g.description}
          entries={g.entries}
          settingsByKey={settingsByKey}
          pendingKey={pendingKey}
          onBooleanChange={handleBooleanChange}
          onOpenEdit={openManifestModal}
        />
      ))}

      <Card title="Ostalo (ključevi izvan manifesta)" className="mb-4">
        <Space direction="vertical" className="w-full" size="middle">
          <Typography.Paragraph type="secondary" className="!mb-0 max-w-3xl">
            Prikaz su korisnički i sistemski ključevi koji nisu u manifestu (npr.{' '}
            <code className="text-xs">user:tour-state:*</code>, budući ključevi). Uredi otvara modal.
          </Typography.Paragraph>
          <Input
            placeholder="Pretraga po ključu ili opisu…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
          />
          <Collapse
            items={[
              {
                key: 'legacy',
                label: `Lista (${advancedRows.length})`,
                children: (
                  <Table<SettingRow>
                    dataSource={advancedRows}
                    rowKey="key"
                    loading={isLoading}
                    pagination={{ pageSize: 15, showSizeChanger: true }}
                    locale={{ emptyText: 'Nema ključeva izvan manifesta' }}
                    columns={[
                      {
                        title: 'Postavka',
                        render: (_: unknown, record: SettingRow) => (
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
                        width: 220,
                        render: (_: unknown, record: SettingRow) => {
                          if (record.value === 'true' || record.value === 'false') {
                            return (
                              <Typography.Text className="text-sm">
                                {record.value === 'true' ? 'Uključeno' : 'Isključeno'}
                              </Typography.Text>
                            );
                          }
                          return (
                            <Typography.Text className="font-mono text-sm break-all">
                              {record.key.includes('pass') || record.key.includes('secret')
                                ? '••••••••'
                                : record.value}
                            </Typography.Text>
                          );
                        },
                      },
                      {
                        title: '',
                        width: 100,
                        align: 'right',
                        render: (_: unknown, record: SettingRow) => (
                          <Button size="small" type="link" onClick={() => openLegacyModal(record)}>
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

      <Modal
        title={modalEntry ? `Uredi: ${modalEntry.label}` : 'Uredi postavku'}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setModalEntry(null);
          setModalRow(null);
          manifestForm.resetFields();
        }}
        okText="Sačuvaj"
        confirmLoading={updateMutation.isPending}
        onOk={() => handleModalSubmit()}
        destroyOnClose
      >
        <Form form={manifestForm} layout="vertical" className="mt-2">
          {modalEntry ? (
            <>
              <Typography.Paragraph type="secondary" className="!mb-4">
                {modalEntry.description}
              </Typography.Paragraph>
              {renderModalFormFields(modalEntry)}
            </>
          ) : null}
        </Form>
      </Modal>

      <Modal
        title={legacyRow ? `Uredi: ${legacyRow.key}` : 'Uredi'}
        open={legacyModalOpen}
        onCancel={() => {
          setLegacyModalOpen(false);
          setLegacyRow(null);
          legacyForm.resetFields();
        }}
        okText="Sačuvaj"
        confirmLoading={updateMutation.isPending}
        onOk={() => handleLegacySubmit()}
        destroyOnClose
      >
        <Form form={legacyForm} layout="vertical" className="mt-2">
          {legacyRow?.description ? (
            <Typography.Paragraph type="secondary" className="!mb-4">
              {legacyRow.description}
            </Typography.Paragraph>
          ) : null}
          {renderLegacyModalFields()}
        </Form>
      </Modal>
    </div>
  );
}
