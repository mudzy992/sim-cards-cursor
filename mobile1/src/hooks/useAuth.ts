import { useCallback } from 'react';
import { authApi } from '@/api/auth.api';
import { useAuthStore } from '@/store/auth.store';
import type { LoginInput } from '@/types/auth.types';

export function useAuth() {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const setSession = useAuthStore((state) => state.setSession);
  const clearSession = useAuthStore((state) => state.clearSession);
  const hydrate = useAuthStore((state) => state.hydrate);

  const login = useCallback(
    async (input: LoginInput) => {
      const response = await authApi.login(input);
      await setSession({
        user: response.user,
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      });
      return response;
    },
    [setSession],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      await clearSession();
    }
  }, [clearSession]);

  return {
    user,
    isAuthenticated,
    isHydrated,
    hydrate,
    login,
    logout,
  };
}
