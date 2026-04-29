import { Navigate } from 'react-router-dom'
import ModeratedInstalledSimCardsPage from '@/pages/sim-cards/ModeratedInstalledSimCardsPage'
import { useAuthStore } from '@/store/auth.store'

export default function SimCardsIndexPage() {
  const user = useAuthStore((s) => s.user)
  const role = user?.role
  const isModerator = role === 'USER' && (user?.branchModeratorBranchIds?.length ?? 0) > 0
  const isAdmin = role === 'SYSTEM_ADMIN' || role === 'DIST_ADMIN'

  if (isAdmin) return <Navigate to="/shipments" replace />
  if (isModerator) return <ModeratedInstalledSimCardsPage />
  return <Navigate to="/forbidden" replace />
}

