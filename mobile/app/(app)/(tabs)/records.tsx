import axios from 'axios';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { installationRecordsApi, syncOfflineInstallationRecords, type InstallationRecordItem, type RecordStatus } from '@/api/installation-records.api';
import { useConnectivity } from '@/hooks/useConnectivity';
import { OfflineRequiredNotice } from '@/components/common/OfflineRequiredNotice';
import { palette, radii, spacing, type } from '@/theme/tokens';
import { ScreenTitleBar } from '@/components/ui/ScreenTitleBar';
import { StatusBadge, type StatusTone } from '@/components/ui/StatusBadge';
import { ActionButton } from '@/components/ui/ActionButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { SegmentedFilter, type SegmentOption } from '@/components/ui/SegmentedFilter';

/** 4 kompaktna segmenta; nacrti su rijetki pa ostaju vidljivi pod "Svi". */
type RecordFilter = 'ALL' | 'SENT' | 'SEND_FAILED' | 'DONE';

const recordFilterOptions: Array<SegmentOption<RecordFilter>> = [
  { key: 'ALL', label: 'Svi' },
  { key: 'SENT', label: 'Poslano' },
  { key: 'SEND_FAILED', label: 'Greška' },
  { key: 'DONE', label: 'Završeno' },
];

const statusMeta: Record<RecordStatus, { label: string; tone: StatusTone }> = {
  DRAFT: { label: 'Nacrt', tone: 'neutral' },
  SENT: { label: 'Poslano', tone: 'info' },
  SEND_FAILED: { label: 'Greška slanja', tone: 'danger' },
  SEP_ACTIVATED: { label: 'SEP aktiviran', tone: 'success' },
  LEGACY_COMPLETED: { label: 'Završeno', tone: 'success' },
};

export default function RecordsScreen() {
  const router = useRouter();
  const { isOnline } = useConnectivity();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<InstallationRecordItem[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<RecordFilter>('ALL');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true); else setIsLoading(true);
    setError(null);
    try {
      await syncOfflineInstallationRecords();
      const response = await installationRecordsApi.listMy({ page: 1, limit: 50 });
      setItems(response.items ?? []);
    } catch (err) {
      setError(axios.isAxiosError(err) && !err.response ? 'Backend nije dostupan.' : 'Ne mogu učitati zapisnike.');
    } finally { setIsLoading(false); setIsRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { void load(false); }, [load]));

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return items.filter((item) => {
      const statusMatch = filter === 'ALL'
        || (filter === 'DONE' && (item.status === 'SEP_ACTIVATED' || item.status === 'LEGACY_COMPLETED'))
        || item.status === filter;
      if (!statusMatch) return false;
      if (!search) return true;
      return [item.recordNumber, item.meter?.serialNumber, item.meter?.simCard?.iccid, item.meter?.meterTypeDefinition?.name]
        .some((value) => value?.toLowerCase().includes(search));
    });
  }, [items, query, filter]);

  if (!isOnline) return <OfflineRequiredNotice title="Zapisnici" message="Za pregled zapisnika potrebna je mreža. Offline kreirani zapisnici nalaze se u outbox redu." onRetry={() => void load(true)} />;

  return <SafeAreaView style={styles.root} edges={['top']}>
    <ScreenTitleBar title="Zapisnici" subtitle={`${items.length} zapisa`} actionIcon="refresh" actionLabel="Osvježi" onAction={() => void load(true)} />
    <View style={styles.searchWrap}>
      <Ionicons name="search" size={18} color={palette.textMuted} />
      <TextInput value={query} onChangeText={setQuery} placeholder="Broj zapisnika, brojilo ili ICCID"
        placeholderTextColor={palette.textMuted} style={styles.search} autoCapitalize="none" />
      {query ? <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Očisti pretragu">
        <Ionicons name="close-circle" size={18} color={palette.textMuted} />
      </Pressable> : null}
    </View>
    <SegmentedFilter options={recordFilterOptions} value={filter} onChange={setFilter} style={styles.filters} />
    {isLoading ? <View style={styles.loading}><SkeletonRows count={6} /></View> : error ? <View style={styles.state}>
      <Text style={styles.error}>{error}</Text><ActionButton title="Pokušaj ponovo" onPress={() => void load(true)} />
    </View> : <FlatList data={filtered} keyExtractor={(item) => item.id} contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void load(true)} colors={[palette.brand]} />}
      ListEmptyComponent={<EmptyState icon="document-text-outline" title="Nema zapisnika"
        description={query ? 'Nijedan zapis ne odgovara pretrazi.' : 'Kreirani zapisnici pojavit će se ovdje.'} />}
      renderItem={({ item }) => {
        const meta = statusMeta[item.status] ?? { label: item.status, tone: 'neutral' as const };
        return <View style={styles.row}>
          <View style={styles.rowTop}><View style={styles.rowBody}>
            <Text style={type.dataLarge}>{item.recordNumber}</Text>
            <Text style={[type.caption, styles.meta]}>{item.meter?.serialNumber ?? 'Brojilo —'} · {item.meter?.meterTypeDefinition?.name ?? 'Tip —'}</Text>
            <Text style={[type.dataSmall, styles.iccid]}>SIM {item.meter?.simCard?.iccid ?? '—'}</Text>
          </View><StatusBadge tone={meta.tone} label={meta.label} /></View>
          <ActionButton title="Otvori detalje" icon="arrow-forward" variant="ghost" size="sm"
            onPress={() => router.push({ pathname: '/(app)/record-details', params: { id: item.id } })} style={styles.details} />
        </View>;
      }} />}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.background },
  searchWrap: { marginHorizontal: spacing.xl, marginBottom: spacing.md, minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: palette.border, borderRadius: radii.md, backgroundColor: palette.surface, paddingHorizontal: spacing.md },
  search: { flex: 1, color: palette.textPrimary, fontSize: 14 },
  filters: { marginHorizontal: spacing.xl, marginBottom: spacing.md },
  loading: { padding: spacing.xl },
  state: { padding: spacing.xl },
  error: { color: palette.danger, marginBottom: spacing.lg },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, flexGrow: 1 },
  row: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border, paddingVertical: spacing.lg },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  rowBody: { flex: 1, minWidth: 0 },
  meta: { marginTop: spacing.xs },
  iccid: { marginTop: spacing.sm },
  details: { alignSelf: 'flex-end', marginTop: spacing.sm },
});