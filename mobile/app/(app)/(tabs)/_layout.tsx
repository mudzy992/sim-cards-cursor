import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { installTasksApi } from '@/api/install-tasks.api';
import { demountTasksApi } from '@/api/demount-tasks.api';

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
          headerShown: true,
          headerStyle: {
            backgroundColor: colors.surface,
            height: 52,
          },
          headerTintColor: colors.text,
          headerTitleStyle: {
            color: colors.text,
            fontSize: 16,
          },
          headerTitleAlign: 'center',
          tabBarActiveTintColor: colors.primary,
          tabBarHideOnKeyboard: true,
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: 'Početna',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="scan"
          options={{
            title: 'Skeniranje',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="scan" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="records"
          options={{
            title: 'Zapisnici',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="document-text" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="demount"
          options={{
            title: 'Demontaža',
            tabBarBadge: demountBadge,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="construct" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="install"
          options={{
            title: 'Ugradnja',
            tabBarBadge: installBadge,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="hardware-chip-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profil',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </>
  );
}
