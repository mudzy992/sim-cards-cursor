import {
  CrownOutlined,
  LogoutOutlined,
  MenuOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Button, Grid, Layout, Space, Tooltip } from 'antd';
import { useAuth } from '@/hooks/useAuth';
import { NotificationBell } from './NotificationBell';
import { branchModeratorsApi } from '@/api/branch-moderators.api';
import { getUserRoleLabel } from '@/utils/labels.utils';
import { useTranslation } from '@/i18n';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';
import { DensityToggle, StatusBadge, ThemeSwitcher, getUserRoleTone } from '@/components/ui';

const { Header: AntHeader } = Layout;

type HeaderProps = {
  onMobileMenuClick?: () => void;
};

export function Header({ onMobileMenuClick }: HeaderProps) {
  const screens = Grid.useBreakpoint();
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const moderatorsQuery = useQuery({
    queryKey: ['branch-moderators', 'list', 'me', user?.id],
    queryFn: () => branchModeratorsApi.list({ userId: user!.id }),
    enabled: Boolean(user?.id) && user?.role === 'USER',
  });

  const moderatorBranchesLabel =
    (moderatorsQuery.data ?? [])
      .map((m) => m.branch?.name ?? m.branchId)
      .filter(Boolean)
      .join(', ') || '';

  const isBranchModerator = (moderatorsQuery.data ?? []).length > 0;
  const roleLabel = user?.role ? getUserRoleLabel(user.role, t) : '';
  const hasMultipleRoles = user?.role === 'USER' && isBranchModerator;

  const roleBadge = (() => {
    if (!user?.role) return null;
    if (user.role === 'SYSTEM_ADMIN') {
      return (
        <StatusBadge
          tone={getUserRoleTone(user.role)}
          icon={<CrownOutlined />}
          label={t('layout.header.roleTagAdmin')}
        />
      );
    }
    if (user.role === 'DIST_ADMIN') {
      return (
        <StatusBadge
          tone={getUserRoleTone(user.role)}
          icon={<TeamOutlined />}
          label={t('layout.header.roleTagDist')}
        />
      );
    }
    return (
      <StatusBadge
        tone={getUserRoleTone(user.role)}
        icon={<UserOutlined />}
        label={hasMultipleRoles ? roleLabel : t('layout.header.roleTagOperator')}
      />
    );
  })();

  const moderatorBadge =
    user?.role === 'USER' && isBranchModerator ? (
      <Tooltip
        title={
          moderatorBranchesLabel
            ? t('layout.header.moderatesBranches', { branches: moderatorBranchesLabel })
            : undefined
        }
      >
        <span>
          <StatusBadge
            tone="accent"
            icon={<SafetyCertificateOutlined />}
            label={t('layout.header.roleTagModerator')}
          />
        </span>
      </Tooltip>
    ) : null;

  const isMobile = !screens.sm;
  const showMenuButton = Boolean(onMobileMenuClick) && isMobile;

  return (
    <AntHeader className="app-header !px-4 sm:!px-6">
      <div className="flex h-full items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {showMenuButton ? (
            <Button
              type="text"
              icon={<MenuOutlined />}
              onClick={onMobileMenuClick}
              aria-label={t('layout.header.openMenu')}
              className="-ml-2"
            />
          ) : null}
          <div className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 truncate text-sm text-fg-secondary">
              {t('layout.header.welcome')}{' '}
              <span className="font-semibold text-fg-primary">
                {user?.firstName ?? t('layout.header.defaultUserName')}
              </span>
            </span>
            <div className="flex shrink-0 items-center gap-2">
              {roleBadge ? <Tooltip title={roleLabel}><span>{roleBadge}</span></Tooltip> : null}
              {moderatorBadge}
            </div>
          </div>
        </div>

        <Space size="small">
          <div
            data-tour-id={
              user?.role === 'SYSTEM_ADMIN'
                ? 'admin-notifications'
                : user?.role === 'DIST_ADMIN'
                  ? 'moderator-notifications'
                  : undefined
            }
          >
            <NotificationBell />
          </div>
          <DensityToggle />
          <ThemeSwitcher />
          <LanguageSwitcher />
          <Button
            icon={<LogoutOutlined />}
            onClick={() => void logout()}
            aria-label={t('layout.header.logout')}
          >
            <span className="hidden sm:inline">{t('layout.header.logout')}</span>
          </Button>
        </Space>
      </div>
    </AntHeader>
  );
}
