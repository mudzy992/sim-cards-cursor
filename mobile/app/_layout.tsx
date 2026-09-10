import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Slot } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useAuthStore } from '@/store/auth.store';
import { useI18nStore } from '@/i18n/i18n.store';
import { palette } from '@/theme/tokens';

const queryClient = new QueryClient();

export default function RootLayout() {
  const hydrate = useAuthStore((state) => state.hydrate);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const hydrateI18n = useI18nStore((state) => state.hydrate);
  const isI18nHydrated = useI18nStore((state) => state.isHydrated);

  useEffect(() => {
    void hydrate();
    void hydrateI18n();
  }, [hydrate, hydrateI18n]);

  if (!isHydrated || !isI18nHydrated) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: palette.background,
        }}
      >
        <ActivityIndicator size="large" color={palette.brand} />
      </View>
    );
  }

  return (
    <KeyboardProvider>
      <QueryClientProvider client={queryClient}>
        <Slot />
      </QueryClientProvider>
    </KeyboardProvider>
  );
}