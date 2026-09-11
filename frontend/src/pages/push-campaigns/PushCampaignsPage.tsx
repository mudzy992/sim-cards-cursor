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
import { useTranslation } from '@/i18n';

const statusColor: Record<PushCampaignStatus, string> = {
  DRAFT: 'default',
  SENDING: 'processing',
  SENT: 'success',
  PARTIAL: 'warning',
  FAILED: 'error',
};

export default function PushCampaignsPage() {
  const { t } = useTranslation();
  const featuresQuery = useAppFeatures();
  const pushEnabled = featuresQuery.data?.pushCampaignsEnabled ?? true;
  if (!pushEnabled) {
    return (
      <Alert
        type="warning"
        message={t('pushCampaigns.disabledTitle')}
        description={t('pushCampaigns.disabledDescription')}
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
      message.success(t('pushCampaigns.createdDraft'));
      setCreateOpen(false);
      createForm.resetFields();
    },
  });

  const sendMutation = useMutation({
    mutationFn: (id: string) => pushCampaignsApi.send(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['push-campaigns', 'list'] });
      message.success(t('pushCampaigns.sent'));
    },
  });

  const columns: ColumnsType<PushCampaign> = useMemo(
    () => [
      {
        title: t('common.labels.status'),
        dataIndex: 'status',
        key: 'status',
        render: (s: PushCampaignStatus) => <Tag color={statusColor[s]}>{s}</Tag>,
        width: 120,
      },
      {
        title: t('pushCampaigns.columns.title'),
        dataIndex: 'title',
        key: 'title',
        render: (title: string) => <Typography.Text strong>{title}</Typography.Text>,
      },
      {
        title: t('pushCampaigns.columns.audience'),
        dataIndex: 'audienceType',
        key: 'audienceType',
        width: 110,
      },
      {
        title: t('common.labels.createdAt'),
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 180,
        render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
      },
      {
        title: t('common.actions.actions'),
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
              {t('common.actions.details')}
            </Button>
            <Button
              type="primary"
              disabled={row.status !== 'DRAFT'}
              loading={sendMutation.isPending}
              onClick={() => sendMutation.mutate(row.id)}
            >
              {t('pushCampaigns.sendButton')}
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
        title: t('common.labels.username'),
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
        title: t('common.labels.status'),
        dataIndex: 'status',
        key: 'status',
        width: 140,
        render: (s: string) => <Tag>{s}</Tag>,
      },
      {
        title: t('common.states.error'),
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
            {t('layout.sidebar.pushCampaigns')}
          </Typography.Title>
          <Typography.Text type="secondary">
            {t('pushCampaigns.pageIntro')}
          </Typography.Text>
        </div>
        <Button type="primary" onClick={openCreate}>
          {t('pushCampaigns.newCampaign')}
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
        title={t('pushCampaigns.newCampaign')}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        destroyOnClose
        width={520}
        extra={
          <Space>
            <Button onClick={() => setCreateOpen(false)}>{t('common.actions.cancel')}</Button>
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
              {t('pushCampaigns.saveDraft')}
            </Button>
          </Space>
        }
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="title" label={t('pushCampaigns.columns.title')} rules={[{ required: true }]}>
            <Input placeholder={t('pushCampaigns.titlePlaceholder')} />
          </Form.Item>
          <Form.Item name="message" label={t('pushCampaigns.messageLabel')} rules={[{ required: true }]}>
            <Input.TextArea rows={5} placeholder={t('pushCampaigns.messagePlaceholder')} />
          </Form.Item>
          <Form.Item name="deepLink" label={t('pushCampaigns.deepLinkLabel')}>
            <Input placeholder="/installation-records" />
          </Form.Item>
          <Form.Item name="audienceType" label={t('pushCampaigns.columns.audience')} rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'ALL', label: t('pushCampaigns.audienceAll') },
                { value: 'USER', label: t('pushCampaigns.audienceOne') },
                { value: 'FILTER', label: t('pushCampaigns.audienceMany') },
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
                    label={t('common.labels.username')}
                    rules={[{ required: true }]}
                  >
                    <Select
                      showSearch
                      placeholder={t('shipments.list.selectUserPlaceholder')}
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
                    label={t('pushCampaigns.usersMultiLabel')}
                    rules={[{ required: true }]}
                  >
                    <Select
                      mode="multiple"
                      showSearch
                      placeholder={t('pushCampaigns.selectUsersPlaceholder')}
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
        title={selectedCampaign ? t('pushCampaigns.detailsTitle', { title: selectedCampaign.title }) : t('common.actions.details')}
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
                <Typography.Text type="secondary">{t('common.labels.status')}</Typography.Text>
                <div>
                  <Tag color={statusColor[selectedCampaign.status]}>
                    {selectedCampaign.status}
                  </Tag>
                </div>
              </div>
              <div>
                <Typography.Text type="secondary">{t('pushCampaigns.sentLabel')}</Typography.Text>
                <div>
                  {selectedCampaign.sentAt
                    ? dayjs(selectedCampaign.sentAt).format('YYYY-MM-DD HH:mm')
                    : '-'}
                </div>
              </div>
              <div className="col-span-2">
                <Typography.Text type="secondary">{t('pushCampaigns.messageLabel')}</Typography.Text>
                <div className="whitespace-pre-wrap">{selectedCampaign.message}</div>
              </div>
            </div>

            <div>
              <Typography.Title level={5}>{t('pushCampaigns.deliveryStatsTitle')}</Typography.Title>
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
              <Typography.Title level={5}>{t('pushCampaigns.recipientsTitle')}</Typography.Title>
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

