import axios from 'axios';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { simCardsApi, type MobileSimCard } from '@/api/sim-cards.api';
import { useAuthStore } from '@/store/auth.store';
import { reconcileOfflineSimInventory } from '@/offline/sim-inventory-reconcile';
import { useConnectivity } from '@/hooks/useConnectivity';
import { useTranslation } from '@/i18n/i18n.store';
import {
  radii,
  spacing,
  useTheme,
  useThemedStyles,
  type ThemePalette,
} from '@/theme/tokens';
import { ScreenTitleBar } from '@/components/ui/ScreenTitleBar';
import { ConnectionPill } from '@/components/ui/ConnectionPill';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ActionButton } from '@/components/ui/ActionButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { hapticSuccess } from '@/utils/haptics';

export default function OfflineInventoryScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { isOnline } = useConnectivity();
  const { t } = useTranslation();
  const { palette, type } = useTheme();
  const styles = useThemedStyles(createStyles);
  const params = useLocalSearchParams<{ pickedIccid?: string | string[] }>();
  const pickedIccid =
    typeof params.pickedIccid === 'string'
      ? params.pickedIccid
      : params.pickedIccid?.[0];
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [reconcileSummary, setReconcileSummary] = useState<string | null>(null);
  const [items, setItems] = useState<MobileSimCard[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        if (refresh && user && isOnline) {
          const result = await reconcileOfflineSimInventory(user);
          if (result.removedIccids.length > 0 || result.updated > 0) {
            setReconcileSummary(
              t('mobile.offlineInventory.reconcileSummary', {
                updated: result.updated,
                removed: result.removedIccids.length,
              }),
            );
          }
        }
        setItems(await simCardsApi.listOfflineInventory());
      } catch {
        setError(t('mobile.offlineInventory.loadError'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user, isOnline, t],
  );

  const runExplicitReconcile = async () => {
    if (!user || !isOnline) return;
    setReconciling(true);
    setError(null);
    try {
      const result = await reconcileOfflineSimInventory(user);
      setItems(await simCardsApi.listOfflineInventory());
      hapticSuccess();
      setReconcileSummary(
        t('mobile.offlineInventory.reconcileFullSummary', {
          updated: result.updated,
          removed: result.removedIccids.length,
          kept: result.kept,
        }),
      );
    } catch {
      setError(t('mobile.offlineInventory.reconcileFailed'));
    } finally {
      setReconciling(false);
    }
  };

  useEffect(() => {
    void load(false);
  }, [load]);

  useEffect(() => {
    const iccid = pickedIccid?.trim();
    if (!iccid) return;
    let cancelled = false;
    void (async () => {
      try {
        await simCardsApi.scanByIccidWithOffline(iccid);
      } catch (err) {
        if (!cancelled) {
          Alert.alert(
            axios.isAxiosError(err) && !err.response
              ? t('mobile.common.offline')
              : t('mobile.common.error'),
            axios.isAxiosError(err) && !err.response
              ? t('mobile.offlineInventory.notFoundOffline')
              : t('mobile.offlineInventory.addFailed'),
          );
        }
      } finally {
        if (!cancelled) {
          router.replace('/(app)/offline-inventory' as const);
          await load(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pickedIccid, router, load, t]);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    return value
      ? items.filter(
          (item) =>
            item.iccid.toLowerCase().includes(value) ||
            item.ipAddress?.includes(value),
        )
      : items;
  }, [items, query]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenTitleBar
        title={t('mobile.offlineInventory.title')}
        subtitle={t('mobile.offlineInventory.subtitle', {
          count: items.length,
        })}
        onBack={() => router.back()}
        actionIcon="barcode-outline"
        actionLabel={t('mobile.offlineInventory.addByScan')}
        onAction={() =>
          router.push({
            pathname: '/(app)/(tabs)/scan',
            params: { afterScan: 'inventory' },
          })
        }
      />
      <View style={styles.connectionRow}>
        <ConnectionPill
          isOnline={isOnline}
          detail={
            isOnline
              ? t('mobile.offlineInventory.readyToReconcile')
              : t('mobile.offlineInventory.localData')
          }
        />
        {isOnline && items.length > 0 ? (
          <ActionButton
            testID="offline-inventory-reconcile-btn"
            title={t('mobile.offlineInventory.reconcileButton')}
            icon="sync-outline"
            size="sm"
            variant="secondary"
            fullWidth={false}
            loading={reconciling}
            onPress={() => void runExplicitReconcile()}
          />
        ) : null}
      </View>
      {reconcileSummary ? (
        <Text style={styles.summary}>{reconcileSummary}</Text>
      ) : null}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={palette.textMuted} />
        <TextInput
          testID="offline-inventory-search"
          value={query}
          onChangeText={setQuery}
          placeholder={t('mobile.offlineInventory.searchPlaceholder')}
          placeholderTextColor={palette.textMuted}
          style={styles.search}
          keyboardType="number-pad"
        />
      </View>
      {loading ? (
        <View style={styles.loading}>
          <SkeletonRows count={7} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.iccid}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void load(true)}
              colors={[palette.brandText]}
            />
          }
          ListHeaderComponent={
            error ? <Text style={styles.error}>{error}</Text> : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="archive-outline"
              title={t('mobile.offlineInventory.emptyTitle')}
              description={
                query
                  ? t('mobile.offlineInventory.emptySearchDesc')
                  : t('mobile.offlineInventory.emptyDefaultDesc')
              }
              actionLabel={
                !query ? t('mobile.offlineInventory.addByScan') : undefined
              }
              onAction={
                !query
                  ? () =>
                      router.push({
                        pathname: '/(app)/(tabs)/scan',
                        params: { afterScan: 'inventory' },
                      })
                  : undefined
              }
            />
          }
          renderItem={({ item }) => (
            <Pressable
              testID={`offline-inventory-row-${item.iccid}`}
              onLongPress={() =>
                Alert.alert(
                  t('mobile.offlineInventory.removeOneTitle'),
                  t('mobile.offlineInventory.removeOneMessage', {
                    iccid: item.iccid,
                  }),
                  [
                    { text: t('mobile.common.cancel'), style: 'cancel' },
                    {
                      text: t('mobile.common.remove'),
                      style: 'destructive',
                      onPress: () =>
                        void simCardsApi
                          .removeOfflineInventoryByIccid(item.iccid)
                          .then(() => load(false)),
                    },
                  ],
                )
              }
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.cardIcon}>
                <Ionicons
                  name="card-outline"
                  size={18}
                  color={palette.brandText}
                />
              </View>
              <View style={styles.rowBody}>
                <Text style={type.dataLarge}>{item.iccid}</Text>
                <Text style={[type.dataSmall, styles.ip]}>
                  IP {item.ipAddress ?? '—'}
                </Text>
              </View>
              <StatusBadge
                label={item.status ?? '—'}
                tone={
                  item.status === 'AVAILABLE'
                    ? 'success'
                    : item.status === 'ASSIGNED'
                      ? 'warning'
                      : 'neutral'
                }
              />
            </Pressable>
          )}
          ListFooterComponent={
            items.length ? (
              <>
                <Text style={styles.holdHint}>
                  {t('mobile.offlineInventory.holdHint')}
                </Text>
                <ActionButton
                  title={t('mobile.offlineInventory.clearAllButton')}
                  variant="ghost"
                  onPress={() =>
                    Alert.alert(
                      t('mobile.offlineInventory.clearAllTitle'),
                      t('mobile.offlineInventory.clearAllMessage'),
                      [
                        { text: t('mobile.common.cancel'), style: 'cancel' },
                        {
                          text: t('mobile.common.delete'),
                          style: 'destructive',
                          onPress: () =>
                            void simCardsApi
                              .clearOfflineInventory()
                              .then(() => load(false)),
                        },
                      ],
                    )
                  }
                />
              </>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (palette: ThemePalette) => ({
  root: { flex: 1, backgroundColor: palette.background },
  connectionRow: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: spacing.sm,
  },
  summary: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
    color: palette.success,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  searchWrap: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    minHeight: 46,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    borderRadius: radii.md,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.md,
  },
  search: { flex: 1, color: palette.textPrimary, fontSize: 14 },
  loading: { padding: spacing.xl },
  list: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    flexGrow: 1,
  },
  error: { color: palette.danger, marginBottom: spacing.md },
  row: {
    minHeight: 68,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  pressed: { opacity: 0.72 },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: palette.brandSoft,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  rowBody: { flex: 1, minWidth: 0 },
  ip: { marginTop: 3 },
  holdHint: {
    marginTop: spacing.xl,
    textAlign: 'center' as const,
    color: palette.textMuted,
    fontSize: 12,
  },
});
