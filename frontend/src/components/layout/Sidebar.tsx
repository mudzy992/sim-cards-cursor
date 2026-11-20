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
import { ROUTES } from '@/config/routes';

const { Sider } = Layout;

type SidebarProps = {
  mobileOpen: boolean;
  onMobileClose: () => void;
};

function Brand({ subtitle }: { subtitle: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-default bg-accent text-sm font-bold text-on-accent">
        S
      </div>
      <div className="min-w-0 leading-tight">
        <div className="truncate text-[15px] font-semibold text-fg-primary">SIM Tracker</div>
        <div className="truncate text-[11px] text-fg-muted">{subtitle}</div>
      </div>
    </div>
  );
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const location = useLocation();
  const screens = Grid.useBreakpoint();
  const user = useAuthStore((state) => state.user);
  const role = user?.role;
  const isModerator = role === 'USER' && (user?.branchModeratorBranchIds?.length ?? 0) > 0;
  const { t } = useTranslation();

  const featuresQuery = useAppFeatures();
  const pushCampaignsEnabled = featuresQuery.data?.pushCampaignsEnabled ?? true;

  const items = [
    {
      key: ROUTES.dashboard,
      icon: <DashboardOutlined />,
      label: <Link to={ROUTES.dashboard}>{t('layout.sidebar.dashboard')}</Link>,
    },
    {
      key: ROUTES.analytics,
      icon: <AreaChartOutlined />,
      label: <Link to={ROUTES.analytics}>{t('layout.sidebar.analytics')}</Link>,
    },
    ...(role === 'SYSTEM_ADMIN' || role === 'DIST_ADMIN'
      ? [
          {
            key: ROUTES.shipments,
            icon: <InboxOutlined />,
            label: <Link to={ROUTES.shipments}>{t('layout.sidebar.shipments')}</Link>,
          },
          {
            key: ROUTES.meters,
            icon: <ThunderboltOutlined />,
            label: <Link to={ROUTES.meters}>{t('layout.sidebar.meters')}</Link>,
          },
          {
            key: ROUTES.installationRecords,
            icon: <FileTextOutlined />,
            label: (
              <Link to={ROUTES.installationRecords}>
                {t('layout.sidebar.installationRecords')}
              </Link>
            ),
          },
          {
            key: ROUTES.users,
            icon: <UserOutlined />,
            label: <Link to={ROUTES.users}>{t('layout.sidebar.users')}</Link>,
          },
          {
            key: ROUTES.branchEmailRecipients,
            icon: <MailOutlined />,
            label: (
              <Link to={ROUTES.branchEmailRecipients}>
                {t('layout.sidebar.branchEmailRecipients')}
              </Link>
            ),
          },
          ...(pushCampaignsEnabled
            ? [
                {
                  key: ROUTES.pushCampaigns,
                  icon: <NotificationOutlined />,
                  label: (
                    <Link to={ROUTES.pushCampaigns}>{t('layout.sidebar.pushCampaigns')}</Link>
                  ),
                },
              ]
            : []),
          {
            key: ROUTES.activityLog,
            icon: <UnorderedListOutlined />,
            label: <Link to={ROUTES.activityLog}>{t('layout.sidebar.activityLog')}</Link>,
          },
        ]
      : []),
    ...(isModerator
      ? [
          {
            key: ROUTES.simCards,
            icon: <CreditCardOutlined />,
            label: <Link to={ROUTES.simCards}>{t('layout.sidebar.simCards')}</Link>,
          },
          {
            key: ROUTES.meters,
            icon: <ThunderboltOutlined />,
            label: <Link to={ROUTES.meters}>{t('layout.sidebar.meters')}</Link>,
          },
        ]
      : []),
    ...(role === 'USER'
      ? [
          {
            key: ROUTES.installationRecords,
            icon: <FileTextOutlined />,
            label: (
              <Link to={ROUTES.installationRecords}>
                {t('layout.sidebar.installationRecords')}
              </Link>
            ),
          },
        ]
      : []),
    ...(role === 'SYSTEM_ADMIN'
      ? [
          {
            key: ROUTES.settings,
            icon: <SettingOutlined />,
            label: <Link to={ROUTES.settings}>{t('layout.sidebar.settings')}</Link>,
          },
          {
            key: ROUTES.settingsEmail,
            icon: <MailOutlined />,
            label: <Link to={ROUTES.settingsEmail}>{t('layout.sidebar.emailSmtp')}</Link>,
          },
          {
            key: ROUTES.appReleases,
            icon: <SettingOutlined />,
            label: <Link to={ROUTES.appReleases}>{t('layout.sidebar.appReleases')}</Link>,
          },
        ]
      : []),
  ];

  const isMobile = !screens.lg;

  const isSimCards =
    location.pathname === ROUTES.simCards ||
    location.pathname.startsWith(`${ROUTES.simCards}/`);
  const selectedKey = isSimCards
    ? isModerator
      ? ROUTES.simCards
      : ROUTES.shipments
    : location.pathname;

  const menuNode = (
    <nav aria-label={t('layout.a11y.primaryNavigation')}>
      <Menu
        mode="inline"
        selectedKeys={[selectedKey]}
        items={items}
        onClick={() => {
          if (!isMobile) return;
          onMobileClose();
        }}
      />
    </nav>
  );

  if (isMobile) {
    return (
      <Drawer
        open={mobileOpen}
        onClose={onMobileClose}
        placement="left"
        width={260}
        styles={{ body: { padding: 0 } }}
        title={<Brand subtitle={t('layout.sidebar.consoleSubtitle')} />}
      >
        {menuNode}
      </Drawer>
    );
  }

  return (
    <Sider width={240} breakpoint="lg" collapsedWidth={0} className="app-sider">
      <div className="px-4 py-5">
        <Brand subtitle={t('layout.sidebar.consoleSubtitle')} />
      </div>
      {menuNode}
    </Sider>
  );
}
