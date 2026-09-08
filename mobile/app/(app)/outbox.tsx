import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/auth.store';
import { clearOutbox, listOutbox, syncOutbox, type OutboxItem } from '@/offline/outbox';
import { palette, spacing, type } from '@/theme/tokens';
import { ScreenTitleBar } from '@/components/ui/ScreenTitleBar';
import { StatusBadge, type StatusTone } from '@/components/ui/StatusBadge';
import { ActionButton } from '@/components/ui/ActionButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { Panel } from '@/components/ui/Panel';

const kindLabel: Record<OutboxItem['kind'], string> = {
  INSTALLATION_RECORD_CREATE: 'Kreiranje zapisnika', SIM_CARD_CLAIM: 'Zaduživanje SIM kartice',
  DEMOUNT_TASK_UPDATE_STATUS: 'Demontaža · status', DEMOUNT_TASK_COMPLETE: 'Demontaža · završetak',
  INSTALL_TASK_UPDATE_STATUS: 'Ugradnja · status', INSTALL_TASK_COMPLETE: 'Ugradnja · završetak',
};
const statusMeta: Record<OutboxItem['status'], { label: string; tone: StatusTone }> = {
  PENDING: { label: 'Na čekanju', tone: 'warning' }, SENDING: { label: 'Šaljem', tone: 'info' },
  FAILED: { label: 'Greška', tone: 'danger' }, SENT: { label: 'Poslano', tone: 'success' },
};

export default function OutboxScreen() {
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [items, setItems] = useState<OutboxItem[]>([]);
  const load = useCallback(async (refresh = false) => {
    if (!user) return;
    if (refresh) setRefreshing(true); else setLoading(true);
    try { setItems(await listOutbox(user)); } finally { setLoading(false); setRefreshing(false); }
  }, [user]);
  useEffect(() => { void load(false); }, [load]);
  const counts = useMemo(() => ({
    pending: items.filter((item) => item.status === 'PENDING' || item.status === 'SENDING').length,
    failed: items.filter((item) => item.status === 'FAILED').length,
  }), [items]);
  const sync = async () => {
    if (!user) return;
    setSyncing(true);
    try { await syncOutbox(user, { maxItems: 50 }); } finally { setSyncing(false); await load(true); }
  };

  if (!user) return <SafeAreaView style={styles.root}><EmptyState icon="person-outline" title="Niste prijavljeni" /></SafeAreaView>;
  return <SafeAreaView style={styles.root} edges={['top']}>
    <ScreenTitleBar title="Neposlato" subtitle="Offline akcije i zahtjevi" actionIcon="sync" actionLabel="Pošalji" onAction={() => void sync()} />
    <View style={styles.summary}><Panel tone={counts.failed ? 'danger' : counts.pending ? 'warning' : 'success'}>
      <Text style={type.bodyStrong}>{counts.failed ? `${counts.failed} zahtjeva traži pažnju` : counts.pending ? `${counts.pending} zahtjeva čeka slanje` : 'Sve je sinhronizovano'}</Text>
      <ActionButton title="Pošalji sada" icon="cloud-upload-outline" onPress={() => void sync()} loading={syncing}
        disabled={!items.length} style={styles.syncButton} />
    </Panel></View>
    {loading ? <View style={styles.loading}><SkeletonRows count={5} /></View> : <FlatList data={items} keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} colors={[palette.brand]} />}
      ListEmptyComponent={<EmptyState icon="cloud-done-outline" title="Nema neposlatih stavki" description="Sve lokalne promjene su poslane." />}
      renderItem={({ item }) => { const meta = statusMeta[item.status]; return <View style={styles.row}>
        <View style={styles.rowTop}><View style={styles.rowBody}><Text style={type.bodyStrong}>{kindLabel[item.kind] ?? item.kind}</Text>
          <Text style={[type.caption, styles.date]}>{new Date(item.createdAt).toLocaleString('bs-BA')}</Text></View>
          <StatusBadge label={meta.label} tone={meta.tone} /></View>
        {item.meta?.taskId ? <Text style={[type.dataSmall, styles.meta]}>Task {item.meta.taskId}</Text> : null}
        {item.lastError ? <Text style={styles.itemError}>{item.lastError}</Text> : null}
      </View>; }}
      ListFooterComponent={items.length ? <ActionButton title="Obriši sve lokalne stavke" variant="ghost" onPress={() => Alert.alert('Obriši neposlato', 'Ova radnja se ne može poništiti.', [
        { text: 'Odustani', style: 'cancel' }, { text: 'Obriši', style: 'destructive', onPress: () => void clearOutbox(user).then(() => load(true)) },
      ])} style={styles.clear} /> : null} />}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.background },
  summary: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
  syncButton: { marginTop: spacing.lg },
  loading: { padding: spacing.xl },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, flexGrow: 1 },
  row: { paddingVertical: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  rowBody: { flex: 1 },
  date: { marginTop: 2 },
  meta: { marginTop: spacing.sm },
  itemError: { marginTop: spacing.sm, color: palette.danger, fontSize: 13, lineHeight: 18 },
  clear: { marginTop: spacing.lg },
});