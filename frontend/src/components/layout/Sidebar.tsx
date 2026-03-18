import {
  UserOutlined,
  DashboardOutlined,
  InboxOutlined,
  ThunderboltOutlined,
  FileTextOutlined,
  MailOutlined,
  NotificationOutlined,
  UnorderedListOutlined,
  SettingOutlined,
  AreaChartOutlined,
} from '@ant-design/icons';
import { Layout, Menu } from 'antd';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';

const { Sider } = Layout;

export function Sidebar() {
  const location = useLocation();
  const role = useAuthStore((state) => state.user?.role);

  const items = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: <Link to="/dashboard">Dashboard</Link>,
    },
    {
      key: '/analytics',
      icon: <AreaChartOutlined />,
      label: <Link to="/analytics">Analitika</Link>,
    },
    ...(role === 'SYSTEM_ADMIN' || role === 'MODERATOR'
      ? [
          {
            key: '/shipments',
            icon: <InboxOutlined />,
            label: <Link to="/shipments">Isporuke</Link>,
          },
          {
            key: '/meters',
            icon: <ThunderboltOutlined />,
            label: <Link to="/meters">Brojila</Link>,
          },
          {
            key: '/installation-records',
            icon: <FileTextOutlined />,
            label: <Link to="/installation-records">Zapisnici</Link>,
          },
          {
            key: '/users',
            icon: <UserOutlined />,
            label: <Link to="/users">Korisnici</Link>,
          },
          {
            key: '/recipients',
            icon: <MailOutlined />,
            label: <Link to="/recipients">Primaoci</Link>,
          },
          {
            key: '/push-campaigns',
            icon: <NotificationOutlined />,
            label: <Link to="/push-campaigns">Push kampanje</Link>,
          },
          {
            key: '/activity-log',
            icon: <UnorderedListOutlined />,
            label: <Link to="/activity-log">Dnevnik aktivnosti</Link>,
          },
        ]
      : []),
    ...(role === 'USER'
      ? [
          {
            key: '/installation-records',
            icon: <FileTextOutlined />,
            label: <Link to="/installation-records">Zapisnici</Link>,
          },
        ]
      : []),
    ...(role === 'SYSTEM_ADMIN'
      ? [
          {
            key: '/settings',
            icon: <SettingOutlined />,
            label: <Link to="/settings">Postavke</Link>,
          },
          {
            key: '/settings/email',
            icon: <MailOutlined />,
            label: <Link to="/settings/email">Email / SMTP</Link>,
          },
          {
            key: '/app-releases',
            icon: <SettingOutlined />,
            label: <Link to="/app-releases">App verzije</Link>,
          },
        ]
      : []),
  ];

  return (
    <Sider width={240} theme="light" breakpoint="lg" collapsedWidth={0}>
      <div className="px-4 py-4 text-lg font-semibold">SIM Tracker</div>
      <Menu
        mode="inline"
        selectedKeys={[
          location.pathname === '/sim-cards' || location.pathname.startsWith('/sim-cards/')
            ? '/shipments'
            : location.pathname,
        ]}
        items={items}
      />
    </Sider>
  );
}
