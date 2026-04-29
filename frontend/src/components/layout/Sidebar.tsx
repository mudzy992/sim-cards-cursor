import {
  UserOutlined,
  DashboardOutlined,
  InboxOutlined,
  CreditCardOutlined,
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
import { useAppFeatures } from '@/hooks/useAppFeatures';

const { Sider } = Layout;

export function Sidebar() {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const role = user?.role;
  const isModerator = role === 'USER' && (user?.branchModeratorBranchIds?.length ?? 0) > 0;

  const featuresQuery = useAppFeatures();
  const pushCampaignsEnabled = featuresQuery.data?.pushCampaignsEnabled ?? true;

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
    ...(role === 'SYSTEM_ADMIN' || role === 'DIST_ADMIN'
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
            key: '/branch-email-recipients',
            icon: <MailOutlined />,
            label: <Link to="/branch-email-recipients">Email primaoci</Link>,
          },
          ...(pushCampaignsEnabled
            ? [
                {
                  key: '/push-campaigns',
                  icon: <NotificationOutlined />,
                  label: <Link to="/push-campaigns">Push kampanje</Link>,
                },
              ]
            : []),
          {
            key: '/activity-log',
            icon: <UnorderedListOutlined />,
            label: <Link to="/activity-log">Dnevnik aktivnosti</Link>,
          },
        ]
      : []),
    ...(isModerator
      ? [
          {
            key: '/sim-cards',
            icon: <CreditCardOutlined />,
            label: <Link to="/sim-cards">SIM kartice</Link>,
          },
          {
            key: '/meters',
            icon: <ThunderboltOutlined />,
            label: <Link to="/meters">Brojila</Link>,
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
      {(() => {
        const isSimCards = location.pathname === '/sim-cards' || location.pathname.startsWith('/sim-cards/')
        const selectedKey = isSimCards ? (isModerator ? '/sim-cards' : '/shipments') : location.pathname
        return (
      <Menu
        mode="inline"
        selectedKeys={[selectedKey]}
        items={items}
      />
        )
      })()}
    </Sider>
  );
}
