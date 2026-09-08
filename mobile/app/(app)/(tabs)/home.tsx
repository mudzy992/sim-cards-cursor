/**
 * HomeScreen — REDIZAJN (Faza 2): operativni dashboard, ne BI panel
 * (instrukcije.md §10: odgovoriti u sekundi — online? sinhronizovano?
 * posao? inventar? problem?).
 *
 * Sva logika identicna prethodnoj verziji:
 *  - operator-offline-stats query (offline inventar + tipovi + zapisnici)
 *  - notifications-unread-count
 *  - syncMeterTypesOfflineCache sa global blocking overlayom
 *  - mini tour (useMiniTour)
 * Prezentacija: section/red struktura, ConnectionPill, Panel samo za grupe.
 */
import axios from 'axios';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/auth.store';
import { simCardsApi } from '@/api/sim-cards.api';
import { installationRecordsApi } from '@/api/installation-records.api';
import { notificationsApi } from '@/api/notifications.api';
import { useMiniTour } from '@/hooks/useMiniTour';
import { useConnectivity } from '@/hooks/useConnectivity';
import { offlineCache } from '@/offline/offline-cache';
import { listOutbox } from '@/offline/outbox';
import { syncMeterTypesOfflineCache } from '@/offline/meter-types-sync';
import { useGlobalBlockingStore } from '@/store/global-blocking.store';
import { palette, spacing, type } from '@/theme/tokens';
import { ConnectionPill } from '@/components/ui/ConnectionPill';
import { Section } from '@/components/ui/Section';
import { Panel } from '@/components/ui/Panel';
import { ListRow } from '@/components/ui/ListRow';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ActionButton } from '@/components/ui/ActionButton';
import { Skeleton, SkeletonRows } from '@/components/ui/Skeleton';

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const miniTour = useMiniTour();
  const { isOnline } = useConnectivity();
  const setBlocked = useGlobalBlockingStore((s) => s.setBlocked);
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: operatorStats, isLoading } = useQuery({
    queryKey: ['operator-offline-stats', user?.id, isOnline],
    enabled: Boolean(user),
    queryFn: async () => {
      if (!user) {
        return {
          offlineSimCount: 0,
          offlineMeterTypeCount: 0,
          serverMeterTypeCount: null as number | null,
          installedSimCount: 0,
          outboxPending: 0,
          outboxFailed: 0,
          isStale: true,
          showMeterTypesSync: false,
        };
      }

      const offlineSims = await simCardsApi.listOfflineInventory();
      const cachedTypes = (await offlineCache.meterTypeDefinitions.get(user))?.data ?? [];
      const offlineMeterTypeCount = cachedTypes.length;
      const outboxItems = await listOutbox(user);

      let installedTotal = 0;
      let isStale = true;
      let serverMeterTypeCount: number | null = null;

      if (isOnline) {
        try {
          const resp = await installationRecordsApi.listMy({ page: 1, limit: 1 });
          installedTotal = resp.total ?? resp.items?.length ?? 0;
          const serverTypes = await (
            await import('@/api/meter-type-definitions.api')
          ).meterTypeDefinitionsApi.list();
          serverMeterTypeCount = serverTypes.length;
          isStale = false;
        } catch (e) {
          if (!(axios.isAxiosError(e) && !e.response)) throw e;
        }
      }

      const showMeterTypesSync =
        isOnline && serverMeterTypeCount != null && offlineMeterTypeCount !== serverMeterTypeCount;

      return {
        offlineSimCount: offlineSims.length,
        offlineMeterTypeCount,
        serverMeterTypeCount,
        installedSimCount: installedTotal,
        outboxPending: outboxItems.filter((i) => i.status === 'PENDING' || i.status === 'SENDING')
          .length,
        outboxFailed: outboxItems.filter((i) => i.status === 'FAILED').length,
        isStale,
        showMeterTypesSync,
      };
    },
  });

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: () => notificationsApi.getUnreadCount(),
  });

  const runMeterTypesSync = () => {
    if (!user) return;
    void (async () => {
      setBlocked({
        title: 'Sync tipova brojila',
        subtitle: 'Molimo sačekajte, preuzimamo definicije…',
      });
      try {
        await syncMeterTypesOfflineCache(user);
        await queryClient.invalidateQueries({
          queryKey: ['operator-offline-stats', user.id, isOnline],
        });
      } catch {
        Alert.alert('Sync nije uspio', 'Provjerite internet konekciju i pokušajte ponovo.');
      } finally {
        setBlocked(null);
      }
    })();
  };

  const onRefresh = () => {
    if (!user) return;
    void (async () => {
      setIsRefreshing(true);
      try {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['operator-offline-stats', user.id, isOnline] }),
          queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] }),
        ]);
      } finally {
        setIsRefreshing(false);
      }
    })();
  };

  const connectionDetail = operatorStats
    ? operatorStats.isStale
      ? 'Podaci možda nisu ažurni'
      : 'Sve sinhronizovano'
    : undefined;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      {/* ------------------------------- header ------------------------------- */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>
            Zdravo{user?.firstName ? `, ${user.firstName}` : ''}
          </Text>
          <Text style={styles.dateLine}>
            {new Date().toLocaleDateString('bs-BA', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push('/notifications')}
          accessibilityRole="button"
          accessibilityLabel="Notifikacije"
          style={({ pressed }) => [styles.bell, pressed && styles.pressedSoft]}
        >
          <Ionicons name="notifications-outline" size={20} color={palette.textPrimary} />
          {unreadCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[palette.brand]} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pillRow}>
          <ConnectionPill
            isOnline={isOnline}
            detail={connectionDetail}
            attention={Boolean(operatorStats?.isStale || operatorStats?.showMeterTypesSync)}
          />
        </View>

        {/* ------------------------- sync upozorenje ------------------------- */}
        {operatorStats?.showMeterTypesSync ? (
          <Panel tone="warning" style={styles.syncPanel}>
            <View style={styles.syncHeader}>
              <StatusBadge tone="warning" label="Potrebna sinhronizacija" showDot />
            </View>
            <Text style={[type.body, styles.syncText]}>
              Tipovi brojila na uređaju ({operatorStats.offlineMeterTypeCount}) ne odgovaraju
              serveru ({operatorStats.serverMeterTypeCount}). Sinkronizujte da biste radili sa
              ažurnim definicijama.
            </Text>
            <ActionButton
              title="Sinhroniziraj tipove brojila"
              onPress={runMeterTypesSync}
              variant="primary"
              size="md"
              icon="sync"
            />
          </Panel>
        ) : null}

        {/* ------------------------------ inventar ------------------------------ */}
        <Section label="Inventar na uređaju" hint="lokalni podaci — dostupni i offline">
          {isLoading ? (
            <SkeletonRows count={3} />
          ) : operatorStats ? (
            <Panel padding="none">
              <View style={styles.panelInner}>
                <ListRow
                  title="Slobodne SIM kartice"
                  subtitle="lokalni inventar za ugradnju"
                  icon="card-outline"
                  iconTone="info"
                  value={operatorStats.offlineSimCount}
                  valueMono
                  onPress={() => router.push('/(app)/offline-inventory')}
                />
                <ListRow
                  title="Tipovi brojila"
                  subtitle={
                    operatorStats.serverMeterTypeCount != null
                      ? `${operatorStats.offlineMeterTypeCount} od ${operatorStats.serverMeterTypeCount} sinhronizovano`
                      : 'keširane definicije'
                  }
                  icon="speedometer-outline"
                  iconTone={operatorStats.showMeterTypesSync ? 'warning' : 'success'}
                  value={operatorStats.offlineMeterTypeCount}
                  valueMono
                  divider
                />
                <ListRow
                  title="Outbox red"
                  subtitle={
                    operatorStats.outboxFailed > 0
                      ? `${operatorStats.outboxFailed} neuspjelih zahtjeva`
                      : 'zahtjevi koji čekaju slanje'
                  }
                  icon={operatorStats.outboxPending > 0 ? 'cloud-upload-outline' : 'checkmark-done-outline'}
                  iconTone={operatorStats.outboxFailed > 0 ? 'danger' : operatorStats.outboxPending > 0 ? 'warning' : 'success'}
                  value={operatorStats.outboxPending}
                  valueMono
                  onPress={() => router.push('/(app)/outbox')}
                  divider
                />
              </View>
            </Panel>
          ) : null}
        </Section>

        {/* ------------------------------ aktivnost ------------------------------ */}
        <Section label="Aktivnost">
          {isLoading ? (
            <SkeletonRow />
          ) : operatorStats ? (
            <Panel padding="none">
              <View style={styles.panelInner}>
                <ListRow
                  title="Moji zapisnici"
                  subtitle={
                    operatorStats.isStale
                      ? 'status ažuriranja nepoznat (offline)'
                      : 'ukupno evidentiranih ugradnja'
                  }
                  icon="document-text-outline"
                  iconTone="neutral"
                  value={operatorStats.installedSimCount}
                  valueMono
                  onPress={() => router.push('/(app)/(tabs)/records')}
                />
              </View>
            </Panel>
          ) : null}
        </Section>

        {/* ----------------------------- brze radnje ----------------------------- */}
        <Section label="Brze radnje">
          <Panel padding="none">
            <View style={styles.panelInner}>
              <ListRow
                title="Nova ugradnja"
                subtitle="pokreni postupak ugradnje kartice"
                icon="construct-outline"
                iconTone="info"
                onPress={() => router.push('/(app)/(tabs)/install')}
              />
              <ListRow
                title="Demontaža kartice"
                subtitle="skidanje kartice sa brojila"
                icon="remove-circle-outline"
                iconTone="warning"
                onPress={() => router.push('/(app)/(tabs)/demount')}
                divider
              />
              <ListRow
                title="Skeniraj karticu"
                subtitle="kamera ili ručni unos ICCID-a"
                icon="barcode-outline"
                iconTone="neutral"
                onPress={() => router.push('/(app)/(tabs)/scan')}
                divider
              />
            </View>
          </Panel>
        </Section>

        {/* ------------------------------ mini tour ------------------------------ */}
        {!miniTour.loading && miniTour.visible ? (
          <Panel tone="info" style={styles.tourPanel}>
            <Text style={[type.bodyStrong, styles.tourTitle]}>Kratki vodič kroz aplikaciju</Text>
            <Text style={[type.body, styles.tourText]}>
              • Tab „Skeniranje“ — skeniraj ili unesi ICCID za novi zapisnik.{'\n'}
              • Tab „Ugradnja“ — vođeni postupak ugradnje.{'\n'}
              • Tab „Zapisnici“ — pregledi tvojih zapisnika i statusa.{'\n'}
              • Tab „Demontaža“ — zadaci za skidanje SIM kartica.{'\n'}
              • Tab „Profil“ — osnovni podaci i odjava.
            </Text>
            <View style={styles.tourActions}>
              <Pressable onPress={() => miniTour.dismiss()} hitSlop={8} style={styles.tourSecondary}>
                <Text style={styles.tourSecondaryText}>Kasnije</Text>
              </Pressable>
              <ActionButton
                title="Razumjem"
                onPress={() => void miniTour.complete()}
                variant="primary"
                size="sm"
                fullWidth={false}
                style={styles.tourPrimary}
              />
            </View>
          </Panel>
        ) : null}

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* -------------------------------- stilovi -------------------------------- */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.background },
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  headerLeft: { flexShrink: 1 },
  greeting: { ...type.screenTitle },
  dateLine: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '500',
    color: palette.textMuted,
    textTransform: 'capitalize',
  },
  bell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressedSoft: { opacity: 0.75 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: palette.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },

  pillRow: { marginBottom: spacing.xl },

  syncPanel: { marginBottom: spacing.xl },
  syncHeader: { marginBottom: spacing.sm },
  syncText: { lineHeight: 21, marginBottom: spacing.lg },

  panelInner: { paddingVertical: spacing.xs, paddingHorizontal: spacing.lg },

  tourPanel: { marginBottom: spacing.lg },
  tourTitle: { marginBottom: spacing.sm },
  tourText: { lineHeight: 22 },
  tourActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  tourSecondary: { paddingVertical: spacing.sm },
  tourSecondaryText: { color: palette.textSecondary, fontWeight: '600', fontSize: 14 },
  tourPrimary: { minWidth: 120 },

  bottomPad: { height: spacing.xxl },
});
