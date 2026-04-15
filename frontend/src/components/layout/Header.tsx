import { LogoutOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query'
import { Button, Layout, Space, Typography } from 'antd';
import { useAuth } from '@/hooks/useAuth';
import { NotificationBell } from './NotificationBell';
import { branchModeratorsApi } from '@/api/branch-moderators.api'
import { getUserRoleLabel } from '@/utils/labels.utils'

const { Header: AntHeader } = Layout;

export function Header() {
  const { user, logout } = useAuth();
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
  const roleLabel = user?.role ? getUserRoleLabel(user.role) : ''
  const effectiveRoleLabel =
    user?.role === 'USER' && isBranchModerator ? `${roleLabel} • Moderator podružnice` : roleLabel

  return (
    <AntHeader className="!bg-white !px-6 border-b border-slate-200">
      <div className="flex h-full items-center justify-between">
        <div className="flex flex-col">
          <Typography.Text strong>
            Dobrodošli, {user?.firstName ?? 'Korisnik'}
          </Typography.Text>
          {user?.role === 'USER' && isBranchModerator && moderatorBranchesLabel && (
            <Typography.Text type="secondary" className="text-xs">
              Moderira podružnice: {moderatorBranchesLabel}
            </Typography.Text>
          )}
        </div>
        <Space>
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
          <Typography.Text type="secondary">{effectiveRoleLabel}</Typography.Text>
          <Button icon={<LogoutOutlined />} onClick={() => void logout()}>
            Odjava
          </Button>
        </Space>
      </div>
    </AntHeader>
  );
}
