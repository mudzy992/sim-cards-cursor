import axios from 'axios';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { simCardsApi, type MobileSimCard } from '@/api/sim-cards.api';
import { useAuthStore } from '@/store/auth.store';
import { reconcileOfflineSimInventory } from '@/offline/sim-inventory-reconcile';
import { useConnectivity } from '@/hooks/useConnectivity';
import { palette, radii, spacing, type } from '@/theme/tokens';
import { ScreenTitleBar } from '@/components/ui/ScreenTitleBar';
import { ConnectionPill } from '@/components/ui/ConnectionPill';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ActionButton } from '@/components/ui/ActionButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRows } from '@/components/ui/Skeleton';

export default function OfflineInventoryScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { isOnline } = useConnectivity();
  const params = useLocalSearchParams<{ pickedIccid?: string | string[] }>();
  const pickedIccid = typeof params.pickedIccid === 'string' ? params.pickedIccid : params.pickedIccid?.[0];
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<MobileSimCard[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      if (refresh && user && isOnline) await reconcileOfflineSimInventory(user);
      setItems(await simCardsApi.listOfflineInventory());
    } catch { setError('Nije moguće učitati offline inventar.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [user, isOnline]);
  useEffect(() => { void load(false); }, [load]);
  useEffect(() => {
    const iccid = pickedIccid?.trim();
    if (!iccid) return;
    let cancelled = false;
    void (async () => {
      try { await simCardsApi.scanByIccidWithOffline(iccid); }
      catch (err) {
        if (!cancelled) Alert.alert(axios.isAxiosError(err) && !err.response ? 'Offline' : 'Greška',
          axios.isAxiosError(err) && !err.response ? 'SIM nije nađena u lokalnom inventaru.' : 'Nije moguće dodati SIM u inventar.');
      } finally {
        if (!cancelled) { router.replace('/(app)/offline-inventory' as const); await load(true); }
      }
    })();
    return () => { cancelled = true; };
  }, [pickedIccid, router, load]);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    return value ? items.filter((item) => item.iccid.toLowerCase().includes(value) || item.ipAddress?.includes(value)) : items;
  }, [items, query]);

  return <SafeAreaView style={styles.root} edges={['top']}>
    <ScreenTitleBar title="Offline inventar" subtitle={`${items.length} kartica na uređaju`}
      actionIcon="barcode-outline" actionLabel="Dodaj skenom"
      onAction={() => router.push({ pathname: '/(app)/(tabs)/scan', params: { afterScan: 'inventory' } })} />
    <View style={styles.connection}><ConnectionPill isOnline={isOnline} detail={isOnline ? 'Povuci za usklađivanje' : 'Lokalni podaci'} /></View>
    <View style={styles.searchWrap}><Ionicons name="search" size={18} color={palette.textMuted} />
      <TextInput value={query} onChangeText={setQuery} placeholder="Pretraži ICCID ili IP"
        placeholderTextColor={palette.textMuted} style={styles.search} keyboardType="number-pad" />
    </View>
    {loading ? <View style={styles.loading}><SkeletonRows count={7} /></View> : <FlatList data={filtered} keyExtractor={(item) => item.iccid}
      contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} colors={[palette.brand]} />}
      ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : null}
      ListEmptyComponent={<EmptyState icon="archive-outline" title="Offline inventar je prazan"
        description={query ? 'Nema kartice koja odgovara pretrazi.' : 'Skenirajte kartice koje nosite na teren.'}
        actionLabel={!query ? 'Dodaj skenom' : undefined} onAction={!query ? () => router.push({ pathname: '/(app)/(tabs)/scan', params: { afterScan: 'inventory' } }) : undefined} />}
      renderItem={({ item }) => <Pressable onLongPress={() => Alert.alert('Ukloni karticu', `Ukloniti ${item.iccid} iz offline inventara?`, [
        { text: 'Odustani', style: 'cancel' }, { text: 'Ukloni', style: 'destructive', onPress: () => void simCardsApi.removeOfflineInventoryByIccid(item.iccid).then(() => load(true)) },
      ])} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        <View style={styles.cardIcon}><Ionicons name="card-outline" size={18} color={palette.brand} /></View>
        <View style={styles.rowBody}><Text style={type.dataLarge}>{item.iccid}</Text>
          <Text style={[type.dataSmall, styles.ip]}>IP {item.ipAddress ?? '—'}</Text></View>
        <StatusBadge label={item.status ?? '—'} tone={item.status === 'AVAILABLE' ? 'success' : item.status === 'ASSIGNED' ? 'warning' : 'neutral'} />
      </Pressable>}
      ListFooterComponent={items.length ? <><Text style={styles.holdHint}>Zadržite red za uklanjanje pojedinačne kartice.</Text>
        <ActionButton title="Obriši kompletan inventar" variant="ghost" onPress={() => Alert.alert('Obriši sve', 'Obrisati kompletan offline inventar?', [
          { text: 'Odustani', style: 'cancel' }, { text: 'Obriši', style: 'destructive', onPress: () => void simCardsApi.clearOfflineInventory().then(() => load(true)) },
        ])} /></> : null} />}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.background },
  connection: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  searchWrap: { marginHorizontal: spacing.xl, marginBottom: spacing.md, minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: palette.border, borderRadius: radii.md, backgroundColor: palette.surface, paddingHorizontal: spacing.md },
  search: { flex: 1, color: palette.textPrimary, fontSize: 14 },
  loading: { padding: spacing.xl },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, flexGrow: 1 },
  error: { color: palette.danger, marginBottom: spacing.md },
  row: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border },
  pressed: { opacity: 0.72 },
  cardIcon: { width: 36, height: 36, borderRadius: radii.sm, backgroundColor: palette.brandSoft, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, minWidth: 0 },
  ip: { marginTop: 3 },
  holdHint: { marginTop: spacing.xl, textAlign: 'center', color: palette.textMuted, fontSize: 12 },
});