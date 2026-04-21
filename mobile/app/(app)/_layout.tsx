import { Redirect, Stack, useRouter } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useAppUpdateGate } from '@/hooks/useAppUpdateGate';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { OfflineBanner } from '@/components/common/OfflineBanner'
import { colors } from '@/theme/colors';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Button,
  Text,
  View,
} from 'react-native';
import { useConnectivity } from '@/hooks/useConnectivity'
import { useGlobalBlockingStore } from '@/store/global-blocking.store'
import { normalizeDeepLink } from '../../src/utils/deeplink'

const PrivateLayout = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const router = useRouter()
  const { isOnline } = useConnectivity()
  const [offlineBannerHeight, setOfflineBannerHeight] = useState(0)
  const blocking = useGlobalBlockingStore((s) => ({
    isBlocked: s.isBlocked,
    title: s.title,
    subtitle: s.subtitle,
    consumeQueuedDeepLink: s.consumeQueuedDeepLink,
  }))

  usePushNotifications();
  useOfflineSync();
  const { state: updateState, actions } = useAppUpdateGate();
  const shownOptionalRef = useRef(false);

  useEffect(() => {
    if (!blocking.isBlocked) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true)
    return () => sub.remove()
  }, [blocking.isBlocked])

  useEffect(() => {
    if (blocking.isBlocked) return
    const queued = blocking.consumeQueuedDeepLink()
    if (!queued) return
    const normalized = normalizeDeepLink(queued)
    router.push((normalized ?? '/notifications') as never)
  }, [blocking.isBlocked, blocking.consumeQueuedDeepLink, router])

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
        onPress: () => void actions.download(updateState.latest),
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
            onPress={() => void actions.download(updateState.latest)}
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

  if (updateState.kind === 'downloaded') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={{ flex: 1, padding: 20, justifyContent: 'center' }}>
          <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 10 }}>
            Nadogradnja je preuzeta
          </Text>
          <Text style={{ color: '#334155', marginBottom: 16 }}>
            Verzija {updateState.latest.versionName} (kod {updateState.latest.versionCode}) je
            spremna za instalaciju.
          </Text>
          <Button
            title="Instaliraj"
            onPress={() => void actions.install({ contentUri: updateState.contentUri })}
          />
        </View>
      </SafeAreaView>
    );
  }

  const stackScreenOptions = useMemo(
    () => ({
      headerStyle: {
        backgroundColor: colors.surface,
      },
      headerTintColor: colors.text,
      headerTitleStyle: {
        color: colors.text,
        fontSize: 16,
      },
      headerTitleAlign: 'center' as const,
      headerLargeTitle: false,
      statusBarStyle: 'dark' as const,
      gestureEnabled: !blocking.isBlocked,
    }),
    [blocking.isBlocked],
  )

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <OfflineBanner onHeight={setOfflineBannerHeight} />
      <View style={{ flex: 1, paddingTop: isOnline ? 0 : 24 }}>
        <Stack
          screenOptions={stackScreenOptions}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="record-details" options={{ title: 'Detalji zapisnika' }} />
          <Stack.Screen name="scan-result" options={{ title: 'Rezultat skena' }} />
          <Stack.Screen name="create-record" options={{ title: 'Novi zapisnik' }} />
          <Stack.Screen name="create-record-replacement" options={{ title: 'Zamjena brojila' }} />
          <Stack.Screen name="offline-inventory" options={{ title: 'Offline inventar' }} />
          <Stack.Screen name="outbox" options={{ title: 'Neposlato' }} />
          <Stack.Screen name="notifications" options={{ title: 'Notifikacije' }} />
        </Stack>
      </View>

      {blocking.isBlocked ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <View
            style={{
              width: '100%',
              maxWidth: 360,
              backgroundColor: colors.surface,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 16,
              alignItems: 'center',
            }}
          >
            <ActivityIndicator size="large" color={colors.primary} />
            <Text
              style={{
                marginTop: 12,
                fontSize: 16,
                fontWeight: '800',
                color: colors.text,
                textAlign: 'center',
              }}
            >
              {blocking.title ?? 'Obrada u toku'}
            </Text>
            {blocking.subtitle ? (
              <Text
                style={{
                  marginTop: 6,
                  fontSize: 13,
                  color: colors.textMuted,
                  textAlign: 'center',
                }}
              >
                {blocking.subtitle}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
};

export default PrivateLayout;
