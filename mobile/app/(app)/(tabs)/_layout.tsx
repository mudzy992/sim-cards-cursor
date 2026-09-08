/**
 * TabsLayout — REDIZAJN tab navigacije.
 *
 * Izmjene u odnosu na prethodnu verziju:
 *  1) 6 tabova -> 5. "Profil" je uklonjen iz trake (href: null) jer je rijetko
 *     koristen; ostaje dostupan preko avatara u headeru Pocetne. Ruta i dalje
 *     postoji, pa svi router.push('/(app)/(tabs)/profile') pozivi rade.
 *  2) Redoslijed prati stvarni terenski tok i stavlja skeniranje u centar:
 *     Pocetna · Ugradnja · [SKEN] · Demontaza · Zapisnici
 *  3) Skeniranje je vizuelno dominantno (brand krug), bez labele — primarna
 *     akcija aplikacije prema instrukcije.md §11.
 *  4) Badge logika za install/demount ostaje IDENTICNA (PENDING, refresh 45s).
 */
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { installTasksApi } from '@/api/install-tasks.api';
import { demountTasksApi } from '@/api/demount-tasks.api';
import { palette } from '@/theme/tokens';

function ScanTabIcon({ focused }: { focused: boolean }) {
  return (
    <View style={[styles.scanButton, focused && styles.scanButtonActive]}>
      <Ionicons name="barcode-outline" size={26} color={palette.inverse} />
    </View>
  );
}

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
    const timer = setInterval(() => void load(), 45_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: palette.brand,
          tabBarInactiveTintColor: palette.textMuted,
          tabBarLabelStyle: styles.tabLabel,
          tabBarStyle: styles.tabBar,
          tabBarItemStyle: styles.tabItem,
          tabBarBadgeStyle: styles.badge,
        }}
      >
        {/* 1 — Početna */}
        <Tabs.Screen
          name="home"
          options={{
            title: 'Početna',
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons name={focused ? 'home' : 'home-outline'} size={size - 2} color={color} />
            ),
          }}
        />

        {/* 2 — Ugradnja */}
        <Tabs.Screen
          name="install"
          options={{
            title: 'Ugradnja',
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

        {/* 3 — Skeniranje (centralna primarna akcija) */}
        <Tabs.Screen
          name="scan"
          options={{
            title: 'Skeniraj',
            tabBarLabel: () => null,
            tabBarAccessibilityLabel: 'Skeniraj SIM karticu',
            tabBarIcon: ({ focused }) => <ScanTabIcon focused={focused} />,
          }}
        />

        {/* 4 — Demontaža */}
        <Tabs.Screen
          name="demount"
          options={{
            title: 'Demontaža',
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

        {/* 5 — Zapisnici */}
        <Tabs.Screen
          name="records"
          options={{
            title: 'Zapisnici',
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons name={focused ? 'albums' : 'albums-outline'} size={size - 2} color={color} />
            ),
          }}
        />

        {/* Profil — ruta ostaje aktivna, ali van tab trake */}
        <Tabs.Screen name="profile" options={{ href: null, title: 'Profil' }} />
      </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
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
    fontWeight: '600',
    marginTop: 2,
  },
  badge: {
    backgroundColor: palette.danger,
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    minWidth: 17,
    height: 17,
    lineHeight: 16,
  },
  scanButton: {
    width: 50,
    height: 38,
    borderRadius: 12,
    backgroundColor: palette.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanButtonActive: { backgroundColor: palette.brandPressed },
});
