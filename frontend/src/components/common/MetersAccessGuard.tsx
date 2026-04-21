import type { PropsWithChildren } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'

export function MetersAccessGuard({ children }: PropsWithChildren) {
  const user = useAuthStore((s) => s.user)
  const moderated = user?.branchModeratorBranchIds ?? []
  const isModerator = user?.role === 'USER' && moderated.length > 0
  const isAdmin = user?.role === 'SYSTEM_ADMIN' || user?.role === 'DIST_ADMIN'

  if (!user || (!isAdmin && !isModerator)) {
    return <Navigate to="/forbidden" replace />
  }

  return children
}

