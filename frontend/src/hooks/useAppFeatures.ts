import { useQuery } from '@tanstack/react-query';
import { settingsApi, type AppFeatures } from '@/api/settings.api';
import { useAuthStore } from '@/store/auth.store';

export function useAppFeatures() {
  const role = useAuthStore((s) => s.user?.role);
  return useQuery<AppFeatures>({
    queryKey: ['settings', 'features'],
    queryFn: () => settingsApi.getFeatures(),
    enabled: !!role,
    staleTime: 60 * 1000,
  });
}

