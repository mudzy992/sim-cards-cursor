import { useQuery } from '@tanstack/react-query';
import { Button, Grid, Layout, Tooltip } from 'antd';
import { useAuth } from '@/hooks/useAuth';
import { NotificationBell } from './NotificationBell';
import { branchModeratorsApi } from '@/api/branch-moderators.api';
import { getUserRoleLabel } from '@/utils/labels.utils';
import { useTranslation } from '@/i18n';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';
import {
  DensityToggle,
  LogoutIcon,
  MenuIcon,
  OperatorRoleIcon,
  OrgRoleIcon,
  ShieldRoleIcon,
  StatusBadge,
  ThemeSwitcher,
  getUserRoleTone,
} from '@/components/ui';

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
          icon={<ShieldRoleIcon />}
          label={t('layout.header.roleTagAdmin')}
        />
      );
    }
    if (user.role === 'DIST_ADMIN') {
      return (
        <StatusBadge
          tone={getUserRoleTone(user.role)}
          icon={<OrgRoleIcon />}
          label={t('layout.header.roleTagDist')}
        />
      );
    }
    return (
      <StatusBadge
        tone={getUserRoleTone(user.role)}
        icon={<OperatorRoleIcon />}
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
            icon={<ShieldRoleIcon />}
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
        <div className="flex min-w-0 items-center gap-2.5">
          {showMenuButton ? (
            <Button
              type="text"
              size="small"
              icon={<MenuIcon />}
              onClick={onMobileMenuClick}
              aria-label={t('layout.header.openMenu')}
              className="-ml-1"
            />
          ) : null}
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="min-w-0 truncate text-sm text-fg-muted">
              {t('layout.header.welcome')}{' '}
              <span className="font-semibold text-fg-primary">
                {user?.firstName ?? t('layout.header.defaultUserName')}
              </span>
            </span>
            <div className="flex shrink-0 items-center gap-1.5">
              {roleBadge ? (
                <Tooltip title={roleLabel}>
                  <span className="inline-flex">{roleBadge}</span>
                </Tooltip>
              ) : null}
              {moderatorBadge}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="inline-flex items-center gap-0.5 rounded-md border border-subtle bg-surface-sunken px-1 py-0.5">
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
          </div>

          <div aria-hidden="true" className="hidden h-5 w-px bg-line-subtle sm:block" />

          <Button
            type="text"
            size="small"
            icon={<LogoutIcon />}
            onClick={() => void logout()}
            aria-label={t('layout.header.logout')}
            className="!px-2.5 text-fg-secondary hover:text-fg-primary"
          >
            <span className="hidden sm:inline text-xs font-medium">{t('layout.header.logout')}</span>
          </Button>
        </div>
      </div>
    </AntHeader>
  );
}
