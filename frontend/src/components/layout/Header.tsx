import { LogoutOutlined } from '@ant-design/icons';
import { Button, Layout, Space, Typography } from 'antd';
import { useAuth } from '@/hooks/useAuth';
import { NotificationBell } from './NotificationBell';

const { Header: AntHeader } = Layout;

export function Header() {
  const { user, logout } = useAuth();

  return (
    <AntHeader className="!bg-white !px-6 border-b border-slate-200">
      <div className="flex h-full items-center justify-between">
        <Typography.Text strong>
          Dobrodošli, {user?.firstName ?? 'Korisnik'}
        </Typography.Text>
        <Space>
          <div
            data-tour-id={
              user?.role === 'SYSTEM_ADMIN'
                ? 'admin-notifications'
                : user?.role === 'MODERATOR'
                ? 'moderator-notifications'
                : undefined
            }
          >
            <NotificationBell />
          </div>
          <Typography.Text type="secondary">{user?.role}</Typography.Text>
          <Button icon={<LogoutOutlined />} onClick={() => void logout()}>
            Odjava
          </Button>
        </Space>
      </div>
    </AntHeader>
  );
}
