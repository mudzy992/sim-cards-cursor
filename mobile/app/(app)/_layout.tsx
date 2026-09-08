import { Redirect, Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/auth.store';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useAppUpdateGate } from '@/hooks/useAppUpdateGate';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { useConnectivity } from '@/hooks/useConnectivity';
import { useGlobalBlockingStore } from '@/store/global-blocking.store';
import { normalizeDeepLink } from '../../src/utils/deeplink';
import { palette, radii, spacing, type } from '@/theme/tokens';
import { ActionButton } from '@/components/ui/ActionButton';

const PrivateLayout = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const router = useRouter();
  const { isOnline } = useConnectivity();
  const [, setOfflineBannerHeight] = useState(0);
  const blocking = useGlobalBlockingStore((state) => ({
    isBlocked: state.isBlocked,
    title: state.title,
    subtitle: state.subtitle,
    consumeQueuedDeepLink: state.consumeQueuedDeepLink,
  }));

  usePushNotifications();
  useOfflineSync();
  const { state: updateState, actions } = useAppUpdateGate();
  const shownOptionalRef = useRef(false);

  const stackScreenOptions = useMemo(
    () => ({
      headerStyle: { backgroundColor: palette.surface },
      headerTintColor: palette.textPrimary,
      headerTitleStyle: { color: palette.textPrimary, fontSize: 16 },
      headerTitleAlign: 'center' as const,
      headerLargeTitle: false,
      headerShadowVisible: true,
      statusBarStyle: 'light' as const,
      statusBarColor: palette.background,
      contentStyle: { backgroundColor: palette.background },
      gestureEnabled: !blocking.isBlocked,
    }),
    [blocking.isBlocked],
  );

  useEffect(() => {
    if (!blocking.isBlocked) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, [blocking.isBlocked]);

  useEffect(() => {
    if (blocking.isBlocked) return;
    const queued = blocking.consumeQueuedDeepLink();
    if (!queued) return;
    router.push((normalizeDeepLink(queued) ?? '/notifications') as never);
  }, [blocking.isBlocked, blocking.consumeQueuedDeepLink, router]);

  useEffect(() => {
    if (updateState.kind !== 'update_available') return;
    if (updateState.isMandatory || shownOptionalRef.current) return;
    shownOptionalRef.current = true;
    Alert.alert(
      'Dostupna je nadogradnja',
      `Nova verzija aplikacije je dostupna (${updateState.latest.versionName}).\n\n` +
        'Možete je instalirati odmah ili odgoditi dok ne postane obavezna.',
      [
        {
          text: 'Kasnije',
          style: 'cancel',
          onPress: () => void actions.postpone(updateState.latest),
        },
        {
          text: 'Nadogradi',
          onPress: () => void actions.openInBrowser(updateState.latest),
        },
      ],
    );
  }, [updateState, actions]);

  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;

  if (updateState.kind === 'update_available' && updateState.isMandatory) {
    return (
      <UpdateGateScreen
        title="Potrebna je nadogradnja"
        description={`Dostupna je nova verzija aplikacije (${updateState.latest.versionName}). Da biste nastavili koristiti aplikaciju, instalirajte nadogradnju.`}
        releaseNotes={updateState.latest.releaseNotes}
        actionLabel="Preuzmi i instaliraj"
        onAction={() => void actions.openInBrowser(updateState.latest)}
      />
    );
  }

  if (updateState.kind === 'opening_browser') {
    return (
      <UpdateGateScreen
        title="Preuzimanje u browseru"
        description={`Otvorili smo browser za download verzije ${updateState.latest.versionName}. Nakon završetka Android će ponuditi instalaciju.`}
        footnote="Ako se instalacija ne pojavi, otvorite Downloads u Chrome-u i tapnite na preuzeti .apk."
        actionLabel="Otvori ponovo"
        onAction={() => void actions.openInBrowser(updateState.latest)}
      />
    );
  }

  return (
    <View style={styles.root}>
      <OfflineBanner onHeight={setOfflineBannerHeight} />
      <View style={[styles.stackWrap, !isOnline && styles.offlineInset]}>
        <Stack screenOptions={stackScreenOptions}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="record-details" options={{ headerShown: false }} />
          <Stack.Screen name="scan-result" options={{ headerShown: false }} />
          <Stack.Screen name="create-record" options={{ headerShown: false }} />
          <Stack.Screen name="create-record-replacement" options={{ headerShown: false }} />
          <Stack.Screen name="offline-inventory" options={{ headerShown: false }} />
          <Stack.Screen name="outbox" options={{ headerShown: false }} />
          <Stack.Screen name="notifications" options={{ headerShown: false }} />
        </Stack>
      </View>

      {blocking.isBlocked ? (
        <View style={styles.blockingOverlay}>
          <View style={styles.blockingPanel}>
            <ActivityIndicator size="large" color={palette.brand} />
            <Text style={[type.bodyStrong, styles.blockingTitle]}>
              {blocking.title ?? 'Obrada u toku'}
            </Text>
            {blocking.subtitle ? (
              <Text style={[type.caption, styles.blockingSubtitle]}>{blocking.subtitle}</Text>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
};

function UpdateGateScreen({
  title,
  description,
  releaseNotes,
  footnote,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  releaseNotes?: string | null;
  footnote?: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <SafeAreaView style={styles.gateSafe}>
      <View style={styles.gateContent}>
        <View style={styles.updateIcon}>
          <Text style={styles.updateIconText}>↑</Text>
        </View>
        <Text style={styles.gateTitle}>{title}</Text>
        <Text style={styles.gateDescription}>{description}</Text>
        {releaseNotes ? (
          <View style={styles.releaseNotes}>
            <Text style={type.sectionLabel}>Šta je novo</Text>
            <Text style={[type.caption, styles.releaseText]}>{releaseNotes}</Text>
          </View>
        ) : null}
        <ActionButton title={actionLabel} icon="download-outline" size="lg" onPress={onAction} />
        {footnote ? <Text style={styles.footnote}>{footnote}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.background },
  stackWrap: { flex: 1 },
  offlineInset: { paddingTop: 24 },
  blockingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.overlayScrim,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  blockingPanel: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    padding: spacing.xl,
    alignItems: 'center',
  },
  blockingTitle: { marginTop: spacing.md, textAlign: 'center' },
  blockingSubtitle: { marginTop: spacing.sm, textAlign: 'center' },
  gateSafe: { flex: 1, backgroundColor: palette.background },
  gateContent: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    maxWidth: 520,
    alignSelf: 'center',
    width: '100%',
  },
  updateIcon: {
    width: 56,
    height: 56,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.brandSoft,
    borderWidth: 1,
    borderColor: palette.infoBorder,
    marginBottom: spacing.xl,
  },
  updateIconText: { color: palette.brand, fontSize: 28, fontWeight: '700' },
  gateTitle: { ...type.screenTitle, fontSize: 24 },
  gateDescription: { ...type.body, color: palette.textSecondary, lineHeight: 22, marginTop: spacing.sm, marginBottom: spacing.xl },
  releaseNotes: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: radii.md, padding: spacing.lg, marginBottom: spacing.xl },
  releaseText: { marginTop: spacing.sm, lineHeight: 19 },
  footnote: { color: palette.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: spacing.lg },
});

export default PrivateLayout;