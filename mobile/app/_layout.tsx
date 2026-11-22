import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Slot } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Appearance, View } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useAuthStore } from '@/store/auth.store';
import { useI18nStore } from '@/i18n/i18n.store';
import { useThemeStore } from '@/store/theme.store';
import { useTheme } from '@/theme/tokens';
import { AppErrorBoundary } from '@/components/common/AppErrorBoundary';

const queryClient = new QueryClient();

export default function RootLayout() {
  const hydrate = useAuthStore((state) => state.hydrate);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const hydrateI18n = useI18nStore((state) => state.hydrate);
  const isI18nHydrated = useI18nStore((state) => state.isHydrated);
  const hydrateTheme = useThemeStore((state) => state.hydrate);
  const isThemeHydrated = useThemeStore((state) => state.isHydrated);
  const syncSystemScheme = useThemeStore((state) => state.syncSystemScheme);
  const { palette } = useTheme();

  useEffect(() => {
    void hydrate();
    void hydrateI18n();
    void hydrateTheme();
    const normalize = (scheme: string | null | undefined) =>
      scheme === 'light' || scheme === 'dark' ? scheme : null;
    syncSystemScheme(normalize(Appearance.getColorScheme()));
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      syncSystemScheme(normalize(colorScheme));
    });
    return () => sub.remove();
  }, [hydrate, hydrateI18n, hydrateTheme, syncSystemScheme]);

  if (!isHydrated || !isI18nHydrated || !isThemeHydrated) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: palette.background,
        }}
      >
        <ActivityIndicator size="large" color={palette.brandText} />
      </View>
    );
  }

  return (
    <KeyboardProvider>
      <AppErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <Slot />
        </QueryClientProvider>
      </AppErrorBoundary>
    </KeyboardProvider>
  );
}
