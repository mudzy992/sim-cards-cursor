import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { installTasksApi } from '@/api/install-tasks.api';
import { demountTasksApi } from '@/api/demount-tasks.api';
import { useTranslation } from '@/i18n/i18n.store';
import {
  useTheme,
  useThemedStyles,
  type ThemePalette,
} from '@/theme/tokens';

function ScanTabIcon({ focused }: { focused: boolean }) {
  const { palette } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={[styles.scanButton, focused && styles.scanButtonActive]}>
      <Ionicons name="barcode-outline" size={26} color={palette.inverse} />
    </View>
  );
}

export default function TabsLayout() {
  const { palette, isDark } = useTheme();
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const [installBadge, setInstallBadge] = useState<number | undefined>(
    undefined,
  );
  const [demountBadge, setDemountBadge] = useState<number | undefined>(
    undefined,
  );

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [inst, dem] = await Promise.all([
          installTasksApi.getMy({ status: 'PENDING' }),
          demountTasksApi.getMy({ status: 'PENDING' }),
        ]);
        if (!alive) return;
        setInstallBadge(inst.length > 0 ? inst.length : undefined);
        setDemountBadge(dem.length > 0 ? dem.length : undefined);
      } catch {
        if (alive) {
          setInstallBadge(undefined);
          setDemountBadge(undefined);
        }
      }
    };
    void load();
    const timer = setInterval(() => void load(), 45_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: palette.brandText,
          tabBarInactiveTintColor: palette.textMuted,
          tabBarLabelStyle: styles.tabLabel,
          tabBarStyle: styles.tabBar,
          tabBarItemStyle: styles.tabItem,
          tabBarBadgeStyle: styles.badge,
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: t('mobile.tabs.home'),
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons
                name={focused ? 'home' : 'home-outline'}
                size={size - 2}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="install"
          options={{
            title: t('mobile.tabs.install'),
            tabBarBadge: installBadge,
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons
                name={focused ? 'construct' : 'construct-outline'}
                size={size - 2}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="scan"
          options={{
            title: t('mobile.tabs.scan'),
            tabBarLabel: () => null,
            tabBarAccessibilityLabel: t('mobile.tabs.scanAccessibility'),
            tabBarIcon: ({ focused }) => <ScanTabIcon focused={focused} />,
          }}
        />

        <Tabs.Screen
          name="demount"
          options={{
            title: t('mobile.tabs.demount'),
            tabBarBadge: demountBadge,
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons
                name={focused ? 'remove-circle' : 'remove-circle-outline'}
                size={size - 2}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="records"
          options={{
            title: t('mobile.tabs.records'),
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons
                name={focused ? 'albums' : 'albums-outline'}
                size={size - 2}
                color={color}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="profile"
          options={{ href: null, title: t('mobile.tabs.profile') }}
        />
      </Tabs>
    </>
  );
}

const createStyles = (palette: ThemePalette) => ({
  tabBar: {
    backgroundColor: palette.surface,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    height: Platform.select({ ios: 86, default: 66 }),
    paddingTop: 8,
    paddingBottom: Platform.select({ ios: 28, default: 10 }),
    paddingHorizontal: 4,
  },
  tabItem: { paddingVertical: 0 },
  tabLabel: {
    fontSize: 10.5,
    fontWeight: '600' as const,
    marginTop: 2,
  },
  badge: {
    backgroundColor: palette.dangerSolid,
    color: palette.inverse,
    fontSize: 10,
    fontWeight: '700' as const,
    minWidth: 17,
    height: 17,
    lineHeight: 16,
  },
  scanButton: {
    width: 50,
    height: 38,
    borderRadius: 12,
    backgroundColor: palette.brand,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  scanButtonActive: { backgroundColor: palette.brandPressed },
});
