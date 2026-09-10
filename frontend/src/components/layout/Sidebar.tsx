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
import { Drawer, Grid, Layout, Menu } from 'antd';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { useAppFeatures } from '@/hooks/useAppFeatures';
import { useTranslation } from '@/i18n';

const { Sider } = Layout;

type SidebarProps = {
  mobileOpen: boolean
  onMobileClose: () => void
}

function Brand({ subtitle }: { subtitle: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-sm font-bold text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
        S
      </div>
      <div className="min-w-0 leading-tight">
        <div className="truncate text-[15px] font-semibold text-slate-900">SIM Tracker</div>
        <div className="truncate text-[11px] text-slate-500">{subtitle}</div>
      </div>
    </div>
  )
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const location = useLocation();
  const screens = Grid.useBreakpoint()
  const user = useAuthStore((state) => state.user);
  const role = user?.role;
  const isModerator = role === 'USER' && (user?.branchModeratorBranchIds?.length ?? 0) > 0;
  const { t } = useTranslation();

  const featuresQuery = useAppFeatures();
  const pushCampaignsEnabled = featuresQuery.data?.pushCampaignsEnabled ?? true;

  const items = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: <Link to="/dashboard">{t('layout.sidebar.dashboard')}</Link>,
    },
    {
      key: '/analytics',
      icon: <AreaChartOutlined />,
      label: <Link to="/analytics">{t('layout.sidebar.analytics')}</Link>,
    },
    ...(role === 'SYSTEM_ADMIN' || role === 'DIST_ADMIN'
      ? [
          {
            key: '/shipments',
            icon: <InboxOutlined />,
            label: <Link to="/shipments">{t('layout.sidebar.shipments')}</Link>,
          },
          {
            key: '/meters',
            icon: <ThunderboltOutlined />,
            label: <Link to="/meters">{t('layout.sidebar.meters')}</Link>,
          },
          {
            key: '/installation-records',
            icon: <FileTextOutlined />,
            label: <Link to="/installation-records">{t('layout.sidebar.installationRecords')}</Link>,
          },
          {
            key: '/users',
            icon: <UserOutlined />,
            label: <Link to="/users">{t('layout.sidebar.users')}</Link>,
          },
          {
            key: '/branch-email-recipients',
            icon: <MailOutlined />,
            label: <Link to="/branch-email-recipients">{t('layout.sidebar.branchEmailRecipients')}</Link>,
          },
          ...(pushCampaignsEnabled
            ? [
                {
                  key: '/push-campaigns',
                  icon: <NotificationOutlined />,
                  label: <Link to="/push-campaigns">{t('layout.sidebar.pushCampaigns')}</Link>,
                },
              ]
            : []),
          {
            key: '/activity-log',
            icon: <UnorderedListOutlined />,
            label: <Link to="/activity-log">{t('layout.sidebar.activityLog')}</Link>,
          },
        ]
      : []),
    ...(isModerator
      ? [
          {
            key: '/sim-cards',
            icon: <CreditCardOutlined />,
            label: <Link to="/sim-cards">{t('layout.sidebar.simCards')}</Link>,
          },
          {
            key: '/meters',
            icon: <ThunderboltOutlined />,
            label: <Link to="/meters">{t('layout.sidebar.meters')}</Link>,
          },
        ]
      : []),
    ...(role === 'USER'
      ? [
          {
            key: '/installation-records',
            icon: <FileTextOutlined />,
            label: <Link to="/installation-records">{t('layout.sidebar.installationRecords')}</Link>,
          },
        ]
      : []),
    ...(role === 'SYSTEM_ADMIN'
      ? [
          {
            key: '/settings',
            icon: <SettingOutlined />,
            label: <Link to="/settings">{t('layout.sidebar.settings')}</Link>,
          },
          {
            key: '/settings/email',
            icon: <MailOutlined />,
            label: <Link to="/settings/email">{t('layout.sidebar.emailSmtp')}</Link>,
          },
          {
            key: '/app-releases',
            icon: <SettingOutlined />,
            label: <Link to="/app-releases">{t('layout.sidebar.appReleases')}</Link>,
          },
        ]
      : []),
  ];

  const isMobile = !screens.lg

  const isSimCards = location.pathname === '/sim-cards' || location.pathname.startsWith('/sim-cards/')
  const selectedKey = isSimCards ? (isModerator ? '/sim-cards' : '/shipments') : location.pathname

  const menuNode = (
    <Menu
      mode="inline"
      selectedKeys={[selectedKey]}
      items={items}
      onClick={() => {
        if (!isMobile) return
        onMobileClose()
      }}
    />
  )

  if (isMobile) {
    return (
      <Drawer
        open={mobileOpen}
        onClose={onMobileClose}
        placement="left"
        width={260}
        bodyStyle={{ padding: 0 }}
        title={<Brand subtitle={t('layout.sidebar.consoleSubtitle')} />}
      >
        {menuNode}
      </Drawer>
    )
  }

  return (
    <Sider width={240} theme="dark" breakpoint="lg" collapsedWidth={0} className="app-sider">
      <div className="px-4 py-5">
        <Brand subtitle={t('layout.sidebar.consoleSubtitle')} />
      </div>
      {menuNode}
    </Sider>
  );
}
