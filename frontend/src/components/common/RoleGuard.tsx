import type { PropsWithChildren } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import type { UserRole } from '@/types/auth.types';

type RoleGuardProps = PropsWithChildren<{
  allow: UserRole[];
}>;

export function RoleGuard({ allow, children }: RoleGuardProps) {
  const user = useAuthStore((state) => state.user);

  if (!user || !allow.includes(user.role)) {
    return <Navigate to="/forbidden" replace />;
  }

  return children;
}
