import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Dropdown, List, Typography } from 'antd';
import { BellOutlined, CheckOutlined } from '@ant-design/icons';
import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { notificationsApi } from '@/api/notifications.api';
import { useTranslation } from '@/i18n';

export function NotificationBell() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: () => notificationsApi.getUnreadCount(),
    refetchInterval: 30_000,
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications-list'],
    queryFn: () => notificationsApi.list({ limit: 10 }),
    refetchInterval: 30_000,
  });

  const markAsReadMutation = useCallback(
    async (id: string) => {
      await notificationsApi.markAsRead(id);
      void queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
    },
    [queryClient],
  );

  const markAllAsReadMutation = useCallback(async () => {
    await notificationsApi.markAllAsRead();
    void queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    void queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
  }, [queryClient]);

  const dropdownContent = (
    <div className="max-h-96 w-80 overflow-auto">
      <div className="flex items-center justify-between border-b border-subtle p-2">
        <Typography.Text strong>{t('layout.notifications.title')}</Typography.Text>
        {unreadCount > 0 ? (
          <Button type="link" size="small" onClick={() => void markAllAsReadMutation()}>
            {t('layout.notifications.markAllRead')}
          </Button>
        ) : null}
      </div>
      <List
        size="small"
        dataSource={notifications}
        locale={{ emptyText: t('layout.notifications.empty') }}
        renderItem={(item) => (
          <List.Item
            className={item.isRead ? 'opacity-70' : ''}
            actions={
              !item.isRead
                ? [
                    <Button
                      key="read"
                      type="text"
                      size="small"
                      icon={<CheckOutlined />}
                      aria-label={t('layout.notifications.markAllRead')}
                      onClick={() => void markAsReadMutation(item.id)}
                    />,
                  ]
                : undefined
            }
          >
            <List.Item.Meta
              title={
                <span className={item.isRead ? '' : 'font-semibold text-fg-primary'}>
                  {item.title}
                </span>
              }
              description={
                <>
                  <Typography.Text type="secondary" className="block truncate text-xs">
                    {item.message}
                  </Typography.Text>
                  {item.link ? (
                    <Link to={item.link} className="text-xs text-accent-fg hover:underline">
                      {t('layout.notifications.view')}
                    </Link>
                  ) : null}
                </>
              }
            />
          </List.Item>
        )}
      />
    </div>
  );

  return (
    <Dropdown
      popupRender={() => (
        <div className="rounded-xl border border-subtle bg-surface-raised shadow-card">
          {dropdownContent}
        </div>
      )}
      trigger={['click']}
      placement="bottomRight"
    >
      <Button
        type="text"
        aria-label={t('layout.notifications.title')}
        icon={<BellOutlined className="text-lg" />}
      >
        <Badge count={unreadCount} size="small" />
      </Button>
    </Dropdown>
  );
}
