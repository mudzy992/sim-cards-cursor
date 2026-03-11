import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
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
import { useTourStore } from '@/store/tour.store';

type SettingRow = {
  key: string;
  value: string;
  description?: string;
};

export default function SettingsPage() {
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const [messageApi, contextHolder] = message.useMessage();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const { tour, resetWebTourForRole, currentVersion } = useTourStore();

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
      setModalOpen(false);
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
    setModalOpen(true);
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
      <Card>
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

      <Card title="Onboarding / App tour" className="mt-4">
        <Typography.Paragraph type="secondary">
          Tour je role-aware i data-aware. Ovdje možete ručno restartovati tour za trenutnog korisnika.
        </Typography.Paragraph>
        <Divider className="!my-3" />
        <Space direction="vertical">
          <Typography.Text>
            Zadnja verzija tour-a: <strong>{currentVersion}</strong>
          </Typography.Text>
          <Typography.Text>
            Status za SYSTEM_ADMIN:{' '}
            <strong>
              {tour?.web?.systemAdmin?.completedAt ? 'Završen' : 'Nije završen'}
            </strong>
          </Typography.Text>
          <Typography.Text>
            Status za MODERATOR:{' '}
            <strong>
              {tour?.web?.moderator?.completedAt ? 'Završen' : 'Nije završen'}
            </strong>
          </Typography.Text>
          <Space>
            <Button
              onClick={() => {
                if (!user) return;
                if (user.role === 'SYSTEM_ADMIN' || user.role === 'MODERATOR') {
                  void resetWebTourForRole(user.role);
                  messageApi.success('Tour je resetovan. Biće prikazan pri sljedećoj posjeti dashboardu.');
                }
              }}
              disabled={!user || (user.role !== 'SYSTEM_ADMIN' && user.role !== 'MODERATOR')}
            >
              Restart tour za moju ulogu
            </Button>
          </Space>
        </Space>
      </Card>

      <Modal
      title={`Uredi postavku: ${editingKey}`}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditingKey(null);
          form.resetFields();
        }}
        footer={null}
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
                  setModalOpen(false);
                  setEditingKey(null);
                }}
              >
                Odustani
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
