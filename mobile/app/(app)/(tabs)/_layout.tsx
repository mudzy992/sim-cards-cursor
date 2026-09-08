/**
 * TabsLayout — REDIZAJN (Faza 2)
 * Badge logika (install/demount PENDING taskovi, refresh 45s) IDENTICNA originalu.
 * Prezentacija: refinirana tab traka per instrukcije.md
 *  - brand aktivna boja, neutralna neaktivna
 *  - headerShown: false jer ekrani renderuju vlastite header blokove
 *    (ako neki ekran nema vlastiti header → vidi napomenu u REDESIGN-PHASE-1.md)
 */
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { installTasksApi } from '@/api/install-tasks.api';
import { demountTasksApi } from '@/api/demount-tasks.api';
import { palette } from '@/theme/tokens';

export default function TabsLayout() {
  const [installBadge, setInstallBadge] = useState<number | undefined>(undefined);
  const [demountBadge, setDemountBadge] = useState<number | undefined>(undefined);

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
    const t = setInterval(() => void load(), 45_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: palette.brand,
          tabBarInactiveTintColor: palette.textMuted,
          tabBarLabelStyle: styles.tabLabel,
          tabBarStyle: styles.tabBar,
          tabBarItemStyle: styles.tabItem,
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: 'Početna',
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="install"
          options={{
            title: 'Ugradnja',
            tabBarBadge: installBadge,
            tabBarBadgeStyle: styles.badge,
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons name={focused ? 'construct' : 'construct-outline'} size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="scan"
          options={{
            title: 'Skeniraj',
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons name={focused ? 'barcode' : 'barcode-outline'} size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="records"
          options={{
            title: 'Zapisnici',
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons name={focused ? 'albums' : 'albums-outline'} size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="demount"
          options={{
            title: 'Demontaža',
            tabBarBadge: demountBadge,
            tabBarBadgeStyle: styles.badge,
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons name={focused ? 'remove-circle' : 'remove-circle-outline'} size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profil',
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: palette.surface,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    height: Platform.select({ ios: 84, default: 62 }),
    paddingTop: 6,
    paddingBottom: Platform.select({ ios: 28, default: 8 }),
  },
  tabItem: { paddingVertical: 2 },
  tabLabel: { fontSize: 11, fontWeight: '600' },
  badge: {
    backgroundColor: palette.danger,
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
  },
});
