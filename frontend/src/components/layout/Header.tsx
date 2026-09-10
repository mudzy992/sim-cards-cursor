import {
  CrownOutlined,
  LogoutOutlined,
  MenuOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query'
import { Button, Grid, Layout, Space, Tag, Tooltip, Typography } from 'antd';
import { useAuth } from '@/hooks/useAuth';
import { NotificationBell } from './NotificationBell';
import { branchModeratorsApi } from '@/api/branch-moderators.api'
import { getUserRoleLabel } from '@/utils/labels.utils'
import { useTranslation } from '@/i18n';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';

const { Header: AntHeader } = Layout;

type HeaderProps = {
  onMobileMenuClick?: () => void
}

export function Header({ onMobileMenuClick }: HeaderProps) {
  const screens = Grid.useBreakpoint()
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const moderatorsQuery = useQuery({
    queryKey: ['branch-moderators', 'list', 'me', user?.id],
    queryFn: () => branchModeratorsApi.list({ userId: user!.id }),
    enabled: Boolean(user?.id) && user?.role === 'USER',
  })

  const moderatorBranchesLabel =
    (moderatorsQuery.data ?? [])
      .map((m) => m.branch?.name ?? m.branchId)
      .filter(Boolean)
      .join(', ') || ''

  const isBranchModerator = (moderatorsQuery.data ?? []).length > 0
  const roleLabel = user?.role ? getUserRoleLabel(user.role, t) : ''

  const hasMultipleRoles = user?.role === 'USER' && isBranchModerator

  const roleTag = (() => {
    if (!user?.role) return null
    if (user.role === 'SYSTEM_ADMIN') {
      return (
        <Tag color="gold" icon={<CrownOutlined />} className="!m-0">
          {t('layout.header.roleTagAdmin')}
        </Tag>
      )
    }
    if (user.role === 'DIST_ADMIN') {
      return (
        <Tag color="blue" icon={<TeamOutlined />} className="!m-0">
          {t('layout.header.roleTagDist')}
        </Tag>
      )
    }
    return (
      <Tag color="default" icon={<UserOutlined />} className="!m-0">
        {hasMultipleRoles ? null : t('layout.header.roleTagOperator')}
      </Tag>
    )
  })()

  const moderatorTag =
    user?.role === 'USER' && isBranchModerator ? (
      <Tooltip
        title={
          moderatorBranchesLabel
            ? t('layout.header.moderatesBranches', { branches: moderatorBranchesLabel })
            : undefined
        }
      >
        <Tag color="geekblue" icon={<SafetyCertificateOutlined />} className="!m-0">
          {hasMultipleRoles ? null : t('layout.header.roleTagModerator')}
        </Tag>
      </Tooltip>
    ) : null

  const isMobile = !screens.sm
  const showMenuButton = Boolean(onMobileMenuClick) && isMobile

  return (
    <AntHeader className="app-header !bg-surface/80 !px-4 sm:!px-6 border-b border-slate-200">
      <div className="flex h-full items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {showMenuButton && (
            <Button
              type="text"
              icon={<MenuOutlined />}
              onClick={onMobileMenuClick}
              aria-label={t('layout.header.openMenu')}
              className="-ml-2"
            />
          )}
          <div className="flex min-w-0 items-center gap-2">
            <Typography.Text className="min-w-0 truncate text-slate-500">
              {t('layout.header.welcome')}{' '}
              <span className="font-semibold text-slate-900">
                {user?.firstName ?? t('layout.header.defaultUserName')}
              </span>
            </Typography.Text>
            <div className="flex shrink-0 items-center gap-2">
              {roleTag ? <Tooltip title={roleLabel}>{roleTag}</Tooltip> : null}
              {moderatorTag}
            </div>
          </div>
        </div>

        <Space size="middle">
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
