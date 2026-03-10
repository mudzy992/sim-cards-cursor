import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Dropdown, List, Typography } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { notificationsApi } from '@/api/notifications.api';

export function NotificationBell() {
  const queryClient = useQueryClient();

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: () => notificationsApi.getUnreadCount(),
    refetchInterval: 30_000, // fallback polling ako WebSocket ne radi
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
    <div className="w-80 max-h-96 overflow-auto">
      <div className="p-2 border-b flex justify-between items-center">
        <Typography.Text strong>Notifikacije</Typography.Text>
        {unreadCount > 0 && (
          <Button type="link" size="small" onClick={() => void markAllAsReadMutation()}>
            Označi sve kao pročitano
          </Button>
        )}
      </div>
      <List
        size="small"
        dataSource={notifications}
        locale={{ emptyText: 'Nema notifikacija' }}
        renderItem={(item) => (
          <List.Item
            className={item.isRead ? 'opacity-70' : ''}
            onClick={() => !item.isRead && void markAsReadMutation(item.id)}
            style={{ cursor: item.isRead ? 'default' : 'pointer' }}
          >
            <List.Item.Meta
              title={
                <span className={item.isRead ? '' : 'font-semibold'}>
                  {item.title}
                </span>
              }
              description={
                <>
                  <Typography.Text
                    type="secondary"
                    className="text-xs block truncate"
                  >
                    {item.message}
                  </Typography.Text>
                  {item.link && (
                    <Link
                      to={item.link}
                      className="text-xs text-blue-600"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Pogledaj
                    </Link>
                  )}
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
      dropdownRender={() => (
        <div className="bg-white rounded shadow-lg border">{dropdownContent}</div>
      )}
      trigger={['click']}
      placement="bottomRight"
    >
      <Button type="text" icon={<BellOutlined className="text-lg" />}>
        <Badge count={unreadCount} size="small" />
      </Button>
    </Dropdown>
  );
}
