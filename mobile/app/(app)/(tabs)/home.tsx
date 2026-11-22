import axios from 'axios';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
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
import { useAppUpdateCheck } from '@/hooks/useAppUpdateCheck';
import { useTranslation } from '@/i18n/i18n.store';
import { offlineCache } from '@/offline/offline-cache';
import { listOutbox } from '@/offline/outbox';
import { syncMeterTypesOfflineCache } from '@/offline/meter-types-sync';
import { useGlobalBlockingStore } from '@/store/global-blocking.store';
import {
  spacing,
  useTheme,
  useThemedStyles,
  type ThemePalette,
  type ThemeTypography,
} from '@/theme/tokens';
import { ConnectionPill } from '@/components/ui/ConnectionPill';
import { Section } from '@/components/ui/Section';
import { Panel } from '@/components/ui/Panel';
import { ListRow } from '@/components/ui/ListRow';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ActionButton } from '@/components/ui/ActionButton';
import { SkeletonRow, SkeletonRows } from '@/components/ui/Skeleton';

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const miniTour = useMiniTour();
  const { isOnline } = useConnectivity();
  const update = useAppUpdateCheck();
  const { t, language } = useTranslation();
  const setBlocked = useGlobalBlockingStore((s) => s.setBlocked);
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { palette, type, isDark } = useTheme();
  const styles = useThemedStyles(createStyles);

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
      const cachedTypes =
        (await offlineCache.meterTypeDefinitions.get(user))?.data ?? [];
      const offlineMeterTypeCount = cachedTypes.length;
      const outboxItems = await listOutbox(user);

      let installedTotal = 0;
      let isStale = true;
      let serverMeterTypeCount: number | null = null;

      if (isOnline) {
        try {
          const resp = await installationRecordsApi.listMy({
            page: 1,
            limit: 1,
          });
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
        isOnline &&
        serverMeterTypeCount != null &&
        offlineMeterTypeCount !== serverMeterTypeCount;

      return {
        offlineSimCount: offlineSims.length,
        offlineMeterTypeCount,
        serverMeterTypeCount,
        installedSimCount: installedTotal,
        outboxPending: outboxItems.filter(
          (i) => i.status === 'PENDING' || i.status === 'SENDING',
        ).length,
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
        title: t('mobile.home.syncTypesBlockingTitle'),
        subtitle: t('mobile.home.syncTypesBlockingSubtitle'),
      });
      try {
        await syncMeterTypesOfflineCache(user);
        await queryClient.invalidateQueries({
          queryKey: ['operator-offline-stats', user.id, isOnline],
        });
      } catch {
        Alert.alert(
          t('mobile.home.syncTypesFailedTitle'),
          t('mobile.home.syncTypesFailedMessage'),
        );
      } finally {
        setBlocked(null);
      }
    })();
  };

  const handleDownloadUpdate = () => {
    void (async () => {
      const opened = await update.openDownload();
      if (!opened) {
        Alert.alert(
          t('mobile.common.error'),
          t('mobile.update.openFailed'),
        );
      }
    })();
  };

  const onRefresh = () => {
    if (!user) return;
    void (async () => {
      setIsRefreshing(true);
      try {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: ['operator-offline-stats', user.id, isOnline],
          }),
          queryClient.invalidateQueries({
            queryKey: ['notifications-unread-count'],
          }),
          queryClient.invalidateQueries({
            queryKey: ['android-latest-release'],
          }),
        ]);
      } finally {
        setIsRefreshing(false);
      }
    })();
  };

  const connectionDetail = operatorStats
    ? operatorStats.isStale
      ? t('mobile.home.staleDetail')
      : t('mobile.home.syncedDetail')
    : undefined;

  const dateLocale = language === 'en' ? 'en-GB' : 'bs-BA';

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting} testID="home-greeting">
            {user?.firstName
              ? t('mobile.home.greetingNamed', { name: user.firstName })
              : t('mobile.home.greeting')}
          </Text>
          <Text style={styles.dateLine}>
            {new Date().toLocaleDateString(dateLocale, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            testID="home-notifications-btn"
            onPress={() => router.push('/notifications')}
            accessibilityRole="button"
            accessibilityLabel={t('mobile.home.notificationsLabel')}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.pressedSoft,
            ]}
          >
            <Ionicons
              name="notifications-outline"
              size={20}
              color={palette.textPrimary}
            />
            {unreadCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable
            testID="home-profile-btn"
            onPress={() => router.push('/(app)/(tabs)/profile')}
            accessibilityRole="button"
            accessibilityLabel={t('mobile.home.profileLabel')}
            style={({ pressed }) => [
              styles.avatarButton,
              pressed && styles.pressedSoft,
            ]}
          >
            <Text style={styles.avatarText}>
              {(user?.firstName?.[0] ?? '').toUpperCase()}
              {(user?.lastName?.[0] ?? '').toUpperCase()}
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={[palette.brandText]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pillRow}>
          <ConnectionPill
            testID="home-connection-pill"
            isOnline={isOnline}
            detail={connectionDetail}
            attention={Boolean(
              operatorStats?.isStale || operatorStats?.showMeterTypesSync,
            )}
          />
        </View>

        {update.hasUpdate && update.release ? (
          <Panel
            tone={update.isMandatory ? 'danger' : 'info'}
            style={styles.syncPanel}
            testID="home-update-banner"
          >
            <View style={styles.syncHeader}>
              <StatusBadge
                tone={update.isMandatory ? 'danger' : 'info'}
                label={
                  update.isMandatory
                    ? t('mobile.update.mandatoryBadge')
                    : t('mobile.update.availableBadge')
                }
                showDot
              />
            </View>
            <Text style={[type.body, styles.syncText]}>
              {t('mobile.update.bannerBody', {
                version: `${update.release.versionName} (${update.release.versionCode})`,
              })}
            </Text>
            <ActionButton
              testID="home-update-download-btn"
              title={t('mobile.update.downloadButton')}
              onPress={handleDownloadUpdate}
              variant={update.isMandatory ? 'danger' : 'primary'}
              size="md"
              icon="download-outline"
            />
          </Panel>
        ) : null}

        {operatorStats?.showMeterTypesSync ? (
          <Panel tone="warning" style={styles.syncPanel}>
            <View style={styles.syncHeader}>
              <StatusBadge
                tone="warning"
                label={t('mobile.home.syncRequiredBadge')}
                showDot
              />
            </View>
            <Text style={[type.body, styles.syncText]}>
              {t('mobile.home.syncRequiredText', {
                local: operatorStats.offlineMeterTypeCount,
                server: operatorStats.serverMeterTypeCount ?? 0,
              })}
            </Text>
            <ActionButton
              testID="home-sync-types-btn"
              title={t('mobile.home.syncTypesButton')}
              onPress={runMeterTypesSync}
              variant="primary"
              size="md"
              icon="sync"
            />
          </Panel>
        ) : null}

        <Section
          label={t('mobile.home.inventorySection')}
          hint={t('mobile.home.inventoryHint')}
        >
          {isLoading ? (
            <SkeletonRows count={3} />
          ) : operatorStats ? (
            <Panel padding="none">
              <View style={styles.panelInner}>
                <ListRow
                  title={t('mobile.home.freeSimsTitle')}
                  subtitle={t('mobile.home.freeSimsSubtitle')}
                  icon="card-outline"
                  iconTone="info"
                  value={operatorStats.offlineSimCount}
                  valueMono
                  onPress={() => router.push('/(app)/offline-inventory')}
                />
                <ListRow
                  title={t('mobile.home.meterTypesTitle')}
                  subtitle={
                    operatorStats.serverMeterTypeCount != null
                      ? t('mobile.home.meterTypesSyncedSubtitle', {
                          local: operatorStats.offlineMeterTypeCount,
                          server: operatorStats.serverMeterTypeCount,
                        })
                      : t('mobile.home.meterTypesCachedSubtitle')
                  }
                  icon="speedometer-outline"
                  iconTone={
                    operatorStats.showMeterTypesSync ? 'warning' : 'success'
                  }
                  value={operatorStats.offlineMeterTypeCount}
                  valueMono
                  divider
                />
                <ListRow
                  title={t('mobile.home.outboxTitle')}
                  subtitle={
                    operatorStats.outboxFailed > 0
                      ? t('mobile.home.outboxFailedSubtitle', {
                          count: operatorStats.outboxFailed,
                        })
                      : t('mobile.home.outboxPendingSubtitle')
                  }
                  icon={
                    operatorStats.outboxPending > 0
                      ? 'cloud-upload-outline'
                      : 'checkmark-done-outline'
                  }
                  iconTone={
                    operatorStats.outboxFailed > 0
                      ? 'danger'
                      : operatorStats.outboxPending > 0
                        ? 'warning'
                        : 'success'
                  }
                  value={operatorStats.outboxPending}
                  valueMono
                  onPress={() => router.push('/(app)/outbox')}
                  divider
                />
              </View>
            </Panel>
          ) : null}
        </Section>

        <Section label={t('mobile.home.activitySection')}>
          {isLoading ? (
            <SkeletonRow />
          ) : operatorStats ? (
            <Panel padding="none">
              <View style={styles.panelInner}>
                <ListRow
                  title={t('mobile.home.myRecordsTitle')}
                  subtitle={
                    operatorStats.isStale
                      ? t('mobile.home.myRecordsOfflineSubtitle')
                      : t('mobile.home.myRecordsTotalSubtitle')
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

        <Section label={t('mobile.home.quickActionsSection')}>
          <Panel padding="none">
            <View style={styles.panelInner}>
              <ListRow
                title={t('mobile.home.newInstallTitle')}
                subtitle={t('mobile.home.newInstallSubtitle')}
                icon="construct-outline"
                iconTone="info"
                onPress={() => router.push('/(app)/(tabs)/install')}
              />
              <ListRow
                title={t('mobile.home.demountTitle')}
                subtitle={t('mobile.home.demountSubtitle')}
                icon="remove-circle-outline"
                iconTone="warning"
                onPress={() => router.push('/(app)/(tabs)/demount')}
                divider
              />
              <ListRow
                title={t('mobile.home.scanTitle')}
                subtitle={t('mobile.home.scanSubtitle')}
                icon="barcode-outline"
                iconTone="neutral"
                onPress={() => router.push('/(app)/(tabs)/scan')}
                divider
              />
            </View>
          </Panel>
        </Section>

        {!miniTour.loading && miniTour.visible ? (
          <Panel tone="info" style={styles.tourPanel}>
            <Text style={[type.bodyStrong, styles.tourTitle]}>
              {t('mobile.home.tourTitle')}
            </Text>
            <Text style={[type.body, styles.tourText]}>
              {t('mobile.home.tourBody')}
            </Text>
            <View style={styles.tourActions}>
              <Pressable
                onPress={() => miniTour.dismiss()}
                hitSlop={8}
                style={styles.tourSecondary}
              >
                <Text style={styles.tourSecondaryText}>
                  {t('mobile.home.tourLater')}
                </Text>
              </Pressable>
              <ActionButton
                title={t('mobile.home.tourGotIt')}
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

const createStyles = (palette: ThemePalette, type: ThemeTypography) => ({
  root: { flex: 1, backgroundColor: palette.background },
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },

  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  headerLeft: { flexShrink: 1 },
  greeting: { ...type.screenTitle },
  dateLine: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '500' as const,
    color: palette.textMuted,
    textTransform: 'capitalize' as const,
  },
  headerActions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  avatarButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.brand,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  avatarText: {
    color: palette.inverse,
    fontSize: 14,
    fontWeight: '700' as const,
    letterSpacing: 0.4,
  },
  pressedSoft: { opacity: 0.75 },
  badge: {
    position: 'absolute' as const,
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: palette.dangerSolid,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 4,
  },
  badgeText: {
    color: palette.inverse,
    fontSize: 10,
    fontWeight: '700' as const,
  },

  pillRow: { marginBottom: spacing.xl },

  syncPanel: { marginBottom: spacing.xl },
  syncHeader: { marginBottom: spacing.sm },
  syncText: { lineHeight: 21, marginBottom: spacing.lg },

  panelInner: { paddingVertical: spacing.xs, paddingHorizontal: spacing.lg },

  tourPanel: { marginBottom: spacing.lg },
  tourTitle: { marginBottom: spacing.sm },
  tourText: { lineHeight: 22 },
  tourActions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'flex-end' as const,
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  tourSecondary: { paddingVertical: spacing.sm },
  tourSecondaryText: {
    color: palette.textSecondary,
    fontWeight: '600' as const,
    fontSize: 14,
  },
  tourPrimary: { minWidth: 120 },

  bottomPad: { height: spacing.xxl },
});
