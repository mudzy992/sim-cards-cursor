import axios from 'axios';
import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  installationRecordsApi,
  syncOfflineInstallationRecords,
  type InstallationRecordItem,
  type RecordStatus,
} from '@/api/installation-records.api';
import { useConnectivity } from '@/hooks/useConnectivity';
import { useTranslation } from '@/i18n/i18n.store';
import { OfflineRequiredNotice } from '@/components/common/OfflineRequiredNotice';
import {
  radii,
  spacing,
  useTheme,
  useThemedStyles,
  type ThemePalette,
} from '@/theme/tokens';
import { ScreenTitleBar } from '@/components/ui/ScreenTitleBar';
import { StatusBadge, type StatusTone } from '@/components/ui/StatusBadge';
import { ActionButton } from '@/components/ui/ActionButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRows } from '@/components/ui/Skeleton';
import {
  SegmentedFilter,
  type SegmentOption,
} from '@/components/ui/SegmentedFilter';

type RecordFilter = 'ALL' | 'SENT' | 'SEND_FAILED' | 'DONE';

const statusConfig: Record<RecordStatus, { key: string; tone: StatusTone }> = {
  DRAFT: { key: 'mobile.records.statusDraft', tone: 'neutral' },
  SENT: { key: 'mobile.records.statusSent', tone: 'info' },
  SEND_FAILED: { key: 'mobile.records.statusSendFailed', tone: 'danger' },
  SEP_ACTIVATED: { key: 'mobile.records.statusSepActivated', tone: 'success' },
  LEGACY_COMPLETED: { key: 'mobile.records.statusCompleted', tone: 'success' },
};

export default function RecordsScreen() {
  const router = useRouter();
  const { isOnline } = useConnectivity();
  const { t } = useTranslation();
  const { palette, type } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<InstallationRecordItem[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<RecordFilter>('ALL');

  const recordFilterOptions: Array<SegmentOption<RecordFilter>> = useMemo(
    () => [
      { key: 'ALL', label: t('mobile.records.filterAll') },
      { key: 'SENT', label: t('mobile.records.filterSent') },
      { key: 'SEND_FAILED', label: t('mobile.records.filterFailed') },
      { key: 'DONE', label: t('mobile.records.filterDone') },
    ],
    [t],
  );

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setIsRefreshing(true);
      else setIsLoading(true);
      setError(null);
      try {
        await syncOfflineInstallationRecords();
        const response = await installationRecordsApi.listMy({
          page: 1,
          limit: 50,
        });
        setItems(response.items ?? []);
      } catch (err) {
        setError(
          axios.isAxiosError(err) && !err.response
            ? t('mobile.common.backendUnavailable')
            : t('mobile.records.loadError'),
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [t],
  );

  useFocusEffect(
    useCallback(() => {
      void load(false);
    }, [load]),
  );

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return items.filter((item) => {
      const statusMatch =
        filter === 'ALL' ||
        (filter === 'DONE' &&
          (item.status === 'SEP_ACTIVATED' ||
            item.status === 'LEGACY_COMPLETED')) ||
        item.status === filter;
      if (!statusMatch) return false;
      if (!search) return true;
      return [
        item.recordNumber,
        item.meter?.serialNumber,
        item.meter?.simCard?.iccid,
        item.meter?.meterTypeDefinition?.name,
      ].some((value) => value?.toLowerCase().includes(search));
    });
  }, [items, query, filter]);

  if (!isOnline) {
    return (
      <OfflineRequiredNotice
        title={t('mobile.records.title')}
        message={t('mobile.records.offlineNotice')}
        onRetry={() => void load(true)}
      />
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenTitleBar
        title={t('mobile.records.title')}
        subtitle={t('mobile.records.subtitleCount', { count: items.length })}
        actionIcon="refresh"
        actionLabel={t('mobile.common.refresh')}
        onAction={() => void load(true)}
      />
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={palette.textMuted} />
        <TextInput
          testID="records-search-input"
          value={query}
          onChangeText={setQuery}
          placeholder={t('mobile.records.searchPlaceholder')}
          placeholderTextColor={palette.textMuted}
          style={styles.search}
          autoCapitalize="none"
        />
        {query ? (
          <Pressable
            onPress={() => setQuery('')}
            hitSlop={8}
            accessibilityLabel={t('mobile.records.clearSearch')}
          >
            <Ionicons name="close-circle" size={18} color={palette.textMuted} />
          </Pressable>
        ) : null}
      </View>
      <SegmentedFilter
        testID="records-filter-bar"
        options={recordFilterOptions}
        value={filter}
        onChange={setFilter}
        style={styles.filters}
      />
      {isLoading ? (
        <View style={styles.loading}>
          <SkeletonRows count={6} />
        </View>
      ) : error ? (
        <View style={styles.state}>
          <Text style={styles.error}>{error}</Text>
          <ActionButton
            title={t('mobile.common.retry')}
            onPress={() => void load(true)}
          />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => void load(true)}
              colors={[palette.brandText]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="document-text-outline"
              title={t('mobile.records.emptyTitle')}
              description={
                query
                  ? t('mobile.records.emptySearchDesc')
                  : t('mobile.records.emptyDefaultDesc')
              }
            />
          }
          renderItem={({ item }) => {
            const cfg = statusConfig[item.status];
            const label = cfg ? t(cfg.key) : item.status;
            const tone: StatusTone = cfg ? cfg.tone : 'neutral';
            return (
              <View style={styles.row} testID={`record-row-${item.id}`}>
                <View style={styles.rowTop}>
                  <View style={styles.rowBody}>
                    <Text style={type.dataLarge}>{item.recordNumber}</Text>
                    <Text style={[type.caption, styles.meta]}>
                      {item.meter?.serialNumber ??
                        t('mobile.records.meterFallback')}{' '}
                      ·{' '}
                      {item.meter?.meterTypeDefinition?.name ??
                        t('mobile.records.typeFallback')}
                    </Text>
                    <Text style={[type.dataSmall, styles.iccid]}>
                      SIM {item.meter?.simCard?.iccid ?? '—'}
                    </Text>
                  </View>
                  <StatusBadge tone={tone} label={label} />
                </View>
                <ActionButton
                  testID={`record-details-btn-${item.id}`}
                  title={t('mobile.records.openDetails')}
                  icon="arrow-forward"
                  variant="ghost"
                  size="sm"
                  onPress={() =>
                    router.push({
                      pathname: '/(app)/record-details',
                      params: { id: item.id },
                    })
                  }
                  style={styles.details}
                />
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (palette: ThemePalette) => ({
  root: { flex: 1, backgroundColor: palette.background },
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
  filters: { marginHorizontal: spacing.xl, marginBottom: spacing.md },
  loading: { padding: spacing.xl },
  state: { padding: spacing.xl },
  error: { color: palette.danger, marginBottom: spacing.lg },
  list: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    flexGrow: 1,
  },
  row: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
    paddingVertical: spacing.lg,
  },
  rowTop: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: spacing.md,
  },
  rowBody: { flex: 1, minWidth: 0 },
  meta: { marginTop: spacing.xs },
  iccid: { marginTop: spacing.sm },
  details: { alignSelf: 'flex-end' as const, marginTop: spacing.sm },
});
