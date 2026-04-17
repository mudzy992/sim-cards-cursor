import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useAppUpdateGate } from '@/hooks/useAppUpdateGate';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { colors } from '@/theme/colors';
import { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  SafeAreaView,
  Text,
  View,
} from 'react-native';

const PrivateLayout = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  usePushNotifications();
  useOfflineSync();
  const { state: updateState, actions } = useAppUpdateGate();
  const shownOptionalRef = useRef(false);

  useEffect(() => {
    if (updateState.kind !== 'update_available') return;
    if (updateState.isMandatory) return;
    if (shownOptionalRef.current) return;
    shownOptionalRef.current = true;

    const title = 'Dostupna je nadogradnja';
    const msg =
      `Nova verzija aplikacije je dostupna (${updateState.latest.versionName}).\n\n` +
      'Možete je instalirati odmah ili odgoditi (dok ne postane obavezna).';

    Alert.alert(title, msg, [
      {
        text: 'Kasnije',
        style: 'cancel',
        onPress: () => void actions.postpone(updateState.latest),
      },
      {
        text: 'Nadogradi',
        onPress: () => void actions.downloadAndInstall(updateState.latest),
      },
    ]);
  }, [updateState]);

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  if (updateState.kind === 'update_available' && updateState.isMandatory) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={{ flex: 1, padding: 20, justifyContent: 'center' }}>
          <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 10 }}>
            Potrebna je nadogradnja
          </Text>
          <Text style={{ color: '#334155', marginBottom: 16 }}>
            Dostupna je nova verzija aplikacije ({updateState.latest.versionName}). Da biste nastavili
            koristiti aplikaciju, instalirajte nadogradnju.
          </Text>
          {updateState.latest.releaseNotes ? (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontWeight: '600', marginBottom: 6 }}>Release notes</Text>
              <Text style={{ color: '#334155' }}>{updateState.latest.releaseNotes}</Text>
            </View>
          ) : null}
          <Button
            title="Preuzmi i instaliraj"
            onPress={() => void actions.downloadAndInstall(updateState.latest)}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (updateState.kind === 'downloading') {
    const pct =
      updateState.progress != null ? Math.round(updateState.progress * 100) : null;
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={{ flex: 1, padding: 20, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" />
          <Text style={{ marginTop: 12, color: '#334155' }}>
            Preuzimanje nadogradnje{pct != null ? ` (${pct}%)` : '...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          color: colors.text,
        },
        statusBarStyle: 'dark',
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="record-details" options={{ title: 'Detalji zapisnika' }} />
      <Stack.Screen name="scan-result" options={{ title: 'Rezultat skena' }} />
      <Stack.Screen name="create-record" options={{ title: 'Novi zapisnik' }} />
      <Stack.Screen name="offline-inventory" options={{ title: 'Offline inventar' }} />
      <Stack.Screen name="outbox" options={{ title: 'Neposlato' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifikacije' }} />
    </Stack>
  );
};

export default PrivateLayout;
