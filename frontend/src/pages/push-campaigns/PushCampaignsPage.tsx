import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Drawer, Form, Input, Select, Space, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { pushCampaignsApi, type PushCampaign, type PushCampaignAudienceType, type PushCampaignStatus, type PushDeliveryListItem } from '@/api/push-campaigns.api';
import { usersApi } from '@/api/users.api';
import type { UserListItem } from '@/types/user.types';
import { useAppFeatures } from '@/hooks/useAppFeatures';
import { Alert } from 'antd';

const statusColor: Record<PushCampaignStatus, string> = {
  DRAFT: 'default',
  SENDING: 'processing',
  SENT: 'success',
  PARTIAL: 'warning',
  FAILED: 'error',
};

export default function PushCampaignsPage() {
  const featuresQuery = useAppFeatures();
  const pushEnabled = featuresQuery.data?.pushCampaignsEnabled ?? true;
  if (!pushEnabled) {
    return (
      <Alert
        type="warning"
        message="Push kampanje su onemogućene"
        description="Ova funkcionalnost je isključena u sistemskim postavkama (push/mobile notifikacije)."
        showIcon
      />
    );
  }

  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<PushCampaign | null>(null);
  const [userSearch, setUserSearch] = useState('');

  const [createForm] = Form.useForm<{
    title: string;
    message: string;
    deepLink?: string;
    audienceType: PushCampaignAudienceType;
    targetUserId?: string;
    targetUserIds?: string[];
  }>();

  const { data: listData, isLoading } = useQuery({
    queryKey: ['push-campaigns', 'list'],
    queryFn: () => pushCampaignsApi.list({ page: 1, limit: 50 }),
  });

  const createMutation = useMutation({
    mutationFn: (raw: {
      title: string;
      message: string;
      deepLink?: string;
      audienceType: PushCampaignAudienceType;
      targetUserId?: string;
      targetUserIds?: string[];
    }) => {
      // Map form values to API payload:
      // - audienceType=USER -> targetUserId
      // - audienceType=FILTER + targetUserIds -> filters.userIds
      const { targetUserIds, ...rest } = raw;
      const filters =
        rest.audienceType === 'FILTER' && targetUserIds && targetUserIds.length
          ? ({ userIds: targetUserIds } as Record<string, unknown>)
          : undefined;
      return pushCampaignsApi.createDraft({
        ...rest,
        filters,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['push-campaigns', 'list'] });
      message.success('Kampanja je kreirana kao draft');
      setCreateOpen(false);
      createForm.resetFields();
    },
  });

  const sendMutation = useMutation({
    mutationFn: (id: string) => pushCampaignsApi.send(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['push-campaigns', 'list'] });
      message.success('Kampanja je poslana');
    },
  });

  const columns: ColumnsType<PushCampaign> = useMemo(
    () => [
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        render: (s: PushCampaignStatus) => <Tag color={statusColor[s]}>{s}</Tag>,
        width: 120,
      },
      {
        title: 'Naslov',
        dataIndex: 'title',
        key: 'title',
        render: (t: string) => <Typography.Text strong>{t}</Typography.Text>,
      },
      {
        title: 'Publika',
        dataIndex: 'audienceType',
        key: 'audienceType',
        width: 110,
      },
      {
        title: 'Kreirano',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 180,
        render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
      },
      {
        title: 'Akcije',
        key: 'actions',
        width: 240,
        render: (_, row) => (
          <Space>
            <Button
              onClick={() => {
                setSelectedCampaign(row);
                setDetailsOpen(true);
              }}
            >
              Detalji
            </Button>
            <Button
              type="primary"
              disabled={row.status !== 'DRAFT'}
              loading={sendMutation.isPending}
              onClick={() => sendMutation.mutate(row.id)}
            >
              Pošalji
            </Button>
          </Space>
        ),
      },
    ],
    [sendMutation],
  );

  const openCreate = useCallback(() => {
    createForm.setFieldsValue({ audienceType: 'ALL', targetUserId: undefined, targetUserIds: [] });
    setCreateOpen(true);
  }, [createForm]);

  const usersQuery = useQuery({
    queryKey: ['push-campaigns', 'users', userSearch],
    queryFn: async () => {
      const res = await usersApi.list({
        page: 1,
        limit: 20,
        // simple search by first/last/email – API already supports `search` in UsersPage;
        // if not present, this will be ignored server-side.
        // We keep it optional to avoid breaking existing backend.
      } as any);
      return res.items as UserListItem[];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['push-campaigns', 'stats', selectedCampaign?.id],
    queryFn: () => pushCampaignsApi.stats(selectedCampaign!.id),
    enabled: !!selectedCampaign && detailsOpen,
  });

  const { data: recipientsData, isLoading: recipientsLoading } = useQuery({
    queryKey: ['push-campaigns', 'recipients', selectedCampaign?.id],
    queryFn: () => pushCampaignsApi.recipients(selectedCampaign!.id, { page: 1, limit: 200 }),
    enabled: !!selectedCampaign && detailsOpen,
  });

  const recipientColumns: ColumnsType<PushDeliveryListItem> = useMemo(
    () => [
      {
        title: 'Korisnik',
        key: 'user',
        render: (_, r) => (
          <div>
            <div className="font-medium">
              {r.user.firstName} {r.user.lastName}
            </div>
            <div className="text-xs text-slate-500">{r.user.email}</div>
          </div>
        ),
      },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        width: 140,
        render: (s: string) => <Tag>{s}</Tag>,
      },
      {
        title: 'Greška',
        key: 'error',
        render: (_, r) => r.errorCode ?? '',
        width: 180,
      },
      {
        title: 'Ticket',
        dataIndex: 'expoTicketId',
        key: 'expoTicketId',
        width: 220,
        render: (v: string | null) => (v ? <span className="font-mono text-xs">{v}</span> : ''),
      },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Push kampanje
          </Typography.Title>
          <Typography.Text type="secondary">
            Ručno slanje push notifikacija (SYSTEM_ADMIN i MODERATOR u scope-u).
          </Typography.Text>
        </div>
        <Button type="primary" onClick={openCreate}>
          Nova kampanja
        </Button>
      </div>

      <Table
        rowKey="id"
        loading={isLoading}
        columns={columns}
        dataSource={listData?.items ?? []}
        pagination={false}
      />

      <Drawer
        title="Nova kampanja"
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        destroyOnClose
        width={520}
        extra={
          <Space>
            <Button onClick={() => setCreateOpen(false)}>Otkaži</Button>
            <Button
              type="primary"
              loading={createMutation.isPending}
              onClick={() => {
                void createForm
                  .validateFields()
                  .then((values) => createMutation.mutate(values))
                  .catch(() => undefined);
              }}
            >
              Snimi draft
            </Button>
          </Space>
        }
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="title" label="Naslov" rules={[{ required: true }]}>
            <Input placeholder="Npr. Planirani prekid" />
          </Form.Item>
          <Form.Item name="message" label="Poruka" rules={[{ required: true }]}>
            <Input.TextArea rows={5} placeholder="Tekst push poruke" />
          </Form.Item>
          <Form.Item name="deepLink" label="Deep link (opciono)">
            <Input placeholder="/installation-records" />
          </Form.Item>
          <Form.Item name="audienceType" label="Publika" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'ALL', label: 'Svi korisnici (scope)' },
                { value: 'USER', label: 'Jedan korisnik' },
                { value: 'FILTER', label: 'Više korisnika (lista)' },
              ]}
            />
          </Form.Item>
          <Form.Item shouldUpdate noStyle>
            {() => {
              const a = createForm.getFieldValue('audienceType');
              if (a === 'USER') {
                return (
                  <Form.Item
                    name="targetUserId"
                    label="Korisnik"
                    rules={[{ required: true }]}
                  >
                    <Select
                      showSearch
                      placeholder="Odaberi korisnika"
                      loading={usersQuery.isLoading}
                      optionFilterProp="label"
                      onSearch={(v) => setUserSearch(v)}
                      filterOption={false}
                      options={(usersQuery.data ?? []).map((u) => ({
                        value: u.id,
                        label: `${u.firstName} ${u.lastName} (${u.email})`,
                      }))}
                    />
                  </Form.Item>
                );
              }
              if (a === 'FILTER') {
                return (
                  <Form.Item
                    name="targetUserIds"
                    label="Korisnici (jedan ili više)"
                    rules={[{ required: true }]}
                  >
                    <Select
                      mode="multiple"
                      showSearch
                      placeholder="Odaberi korisnike"
                      loading={usersQuery.isLoading}
                      optionFilterProp="label"
                      onSearch={(v) => setUserSearch(v)}
                      filterOption={false}
                      options={(usersQuery.data ?? []).map((u) => ({
                        value: u.id,
                        label: `${u.firstName} ${u.lastName} (${u.email})`,
                      }))}
                    />
                  </Form.Item>
                );
              }
              return null;
            }}
          </Form.Item>
        </Form>
      </Drawer>

      <Drawer
        title={selectedCampaign ? `Detalji: ${selectedCampaign.title}` : 'Detalji'}
        open={detailsOpen}
        onClose={() => {
          setDetailsOpen(false);
          setSelectedCampaign(null);
        }}
        destroyOnClose
        width={860}
      >
        {selectedCampaign && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Typography.Text type="secondary">Status</Typography.Text>
                <div>
                  <Tag color={statusColor[selectedCampaign.status]}>
                    {selectedCampaign.status}
                  </Tag>
                </div>
              </div>
              <div>
                <Typography.Text type="secondary">Poslano</Typography.Text>
                <div>
                  {selectedCampaign.sentAt
                    ? dayjs(selectedCampaign.sentAt).format('YYYY-MM-DD HH:mm')
                    : '-'}
                </div>
              </div>
              <div className="col-span-2">
                <Typography.Text type="secondary">Poruka</Typography.Text>
                <div className="whitespace-pre-wrap">{selectedCampaign.message}</div>
              </div>
            </div>

            <div>
              <Typography.Title level={5}>Statistika dostave</Typography.Title>
              <Space>
                <Tag>total: {stats?.total ?? '-'}</Tag>
                <Tag>queued: {stats?.queued ?? '-'}</Tag>
                <Tag>sent: {stats?.sent ?? '-'}</Tag>
                <Tag color="green">delivered: {stats?.delivered ?? '-'}</Tag>
                <Tag color="red">failed: {stats?.failed ?? '-'}</Tag>
                <Tag>invalid: {stats?.invalid ?? '-'}</Tag>
              </Space>
            </div>

            <div>
              <Typography.Title level={5}>Recipienti</Typography.Title>
              <Table
                rowKey="id"
                loading={recipientsLoading}
                columns={recipientColumns}
                dataSource={recipientsData?.items ?? []}
                pagination={false}
                size="small"
              />
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}

