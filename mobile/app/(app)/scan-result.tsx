import axios from 'axios';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { simCardsApi, type MobileSimCard } from '@/api/sim-cards.api';
import { useAuthStore } from '@/store/auth.store';
import { palette, spacing, type } from '@/theme/tokens';
import { ScreenTitleBar } from '@/components/ui/ScreenTitleBar';
import { StatusBadge, type StatusTone } from '@/components/ui/StatusBadge';
import { Panel } from '@/components/ui/Panel';
import { ListRow } from '@/components/ui/ListRow';
import { ActionButton } from '@/components/ui/ActionButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRows } from '@/components/ui/Skeleton';

export default function ScanResultScreen() {
  const router = useRouter();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const params = useLocalSearchParams<{ iccid?: string | string[] }>();
  const iccid = (typeof params.iccid === 'string' ? params.iccid : params.iccid?.[0])?.trim() ?? '';
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [justClaimed, setJustClaimed] = useState(false);

  useEffect(() => { setActionMessage(null); setActionError(null); setJustClaimed(false); }, [iccid]);
  const query = useQuery({ queryKey: ['scan-result', iccid], queryFn: () => simCardsApi.scanByIccidWithOffline(iccid), enabled: Boolean(iccid) });
  const result = query.data as (MobileSimCard & { fromOfflineCache?: boolean }) | undefined;
  const claim = useMutation({
    mutationFn: (id: string) => simCardsApi.claimById(id),
    onSuccess: async () => { setActionError(null); setActionMessage('Kartica je uspješno zadužena.'); setJustClaimed(true); await query.refetch(); },
    onError: (error) => { setActionMessage(null); setActionError(getBackendMessage(error, 'Zaduživanje nije uspjelo.')); },
  });

  const assignedToMe = result?.status === 'ASSIGNED' && result.assignedTo?.id === currentUserId;
  const assignedToAnother = result?.status === 'ASSIGNED' && Boolean(result.assignedTo?.id) && result.assignedTo?.id !== currentUserId;
  const canClaim = result?.status === 'AVAILABLE';
  const canCreateRecord = Boolean(result && (assignedToMe || justClaimed));
  const status = useMemo((): { label: string; tone: StatusTone } => {
    if (!result) return { label: 'Nepoznato', tone: 'neutral' };
    if (result.status === 'AVAILABLE') return { label: 'Dostupna', tone: 'success' };
    if (result.status === 'ASSIGNED') return { label: 'Zadužena', tone: 'warning' };
    if (result.status === 'INSTALLED') return { label: 'Ugrađena', tone: 'info' };
    return { label: result.status, tone: 'neutral' };
  }, [result]);

  return <SafeAreaView style={styles.root} edges={['top']}>
    <ScreenTitleBar title="Rezultat skena" subtitle={iccid || 'ICCID nije dostupan'} onBack={() => router.back()} />
    {!iccid ? <EmptyState icon="alert-circle-outline" title="Nedostaje ICCID" actionLabel="Novi sken" onAction={() => router.replace('/(app)/(tabs)/scan')} />
    : query.isLoading ? <View style={styles.loading}><SkeletonRows count={5} /></View>
    : query.isError || !result ? <View style={styles.state}><EmptyState icon="search-outline"
      title={axios.isAxiosError(query.error) && query.error.response?.status === 404 ? 'SIM kartica nije pronađena' : 'Podaci nisu dostupni'}
      description={axios.isAxiosError(query.error) && !query.error.response ? 'Backend nije dostupan, a kartica nije pronađena u lokalnom inventaru.' : getBackendMessage(query.error, 'Pretraga nije uspjela.')}
      actionLabel="Pokušaj ponovo" onAction={() => void query.refetch()} /></View>
    : <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {result.fromOfflineCache ? <Panel tone="warning" style={styles.notice}><Text style={type.bodyStrong}>Offline podaci</Text>
        <Text style={[type.caption, styles.noticeText]}>Status kartice može biti zastario dok se veza ne vrati.</Text></Panel> : null}

      <Panel style={styles.hero}>
        <View style={styles.heroTop}><Text style={type.sectionLabel}>ICCID</Text><StatusBadge tone={status.tone} label={status.label} showDot /></View>
        <Text style={styles.iccid}>{result.iccid}</Text>
        <View style={styles.ipBlock}><Text style={styles.ipLabel}>EPBIH IP · unesite u brojilo</Text>
          <Text style={styles.ip}>{result.ipAddress ?? '—'}</Text></View>
      </Panel>

      {actionMessage ? <Panel tone="success" style={styles.notice}><Text style={type.bodyStrong}>{actionMessage}</Text></Panel> : null}
      {actionError ? <Panel tone="danger" style={styles.notice}><Text style={styles.errorText}>{actionError}</Text></Panel> : null}

      {canClaim && !justClaimed ? <ActionButton title="Zaduži karticu" icon="person-add-outline" size="lg"
        loading={claim.isPending} onPress={() => claim.mutate(result.id)} style={styles.primary} /> : null}
      {canCreateRecord ? <View style={styles.actions}>
        <ActionButton title="Novi priključak" icon="construct-outline" size="lg"
          onPress={() => router.push({ pathname: '/create-record', params: { simCardId: result.id } })} />
        <ActionButton title="Zamjena brojila" icon="swap-horizontal-outline" variant="secondary" size="lg"
          onPress={() => router.push({ pathname: '/create-record-replacement', params: { simCardId: result.id } })} />
      </View> : null}
      {assignedToAnother ? <Panel tone="warning" style={styles.notice}><Text style={type.bodyStrong}>Kartica je zadužena kod drugog operatora</Text>
        <Text style={[type.caption, styles.noticeText]}>{result.assignedTo ? `${result.assignedTo.firstName} ${result.assignedTo.lastName}` : ''}</Text></Panel> : null}

      <Text style={[type.sectionLabel, styles.sectionTitle]}>Podaci kartice</Text>
      <Panel padding="none"><View style={styles.panelInner}>
        <ListRow title="Operator" value={result.assignedTo ? `${result.assignedTo.firstName} ${result.assignedTo.lastName}` : '—'} />
        <ListRow title="Telefon" value={result.phoneNumber ?? '—'} divider />
        <ListRow title="Isporuka" value={result.shipment?.name ?? '—'} divider />
      </View></Panel>
      <View style={styles.bottomActions}><ActionButton title="Osvježi podatke" icon="refresh" variant="secondary" onPress={() => void query.refetch()} />
        <ActionButton title="Novi sken" icon="barcode-outline" variant="dark" onPress={() => router.replace('/(app)/(tabs)/scan')} /></View>
    </ScrollView>}
  </SafeAreaView>;
}

function getBackendMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) return fallback;
  const value = error.response?.data?.message;
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && typeof (value as { message?: string }).message === 'string') return (value as { message: string }).message;
  return fallback;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.background },
  loading: { padding: spacing.xl },
  state: { flex: 1, justifyContent: 'center' },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  notice: { marginBottom: spacing.lg },
  noticeText: { marginTop: spacing.xs },
  hero: { marginBottom: spacing.lg },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  iccid: { ...type.dataLarge, fontSize: 19, marginTop: spacing.lg },
  ipBlock: { marginTop: spacing.xl, paddingTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border },
  ipLabel: { color: palette.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  ip: { ...type.dataLarge, color: palette.brand, fontSize: 22, marginTop: spacing.xs },
  errorText: { color: palette.danger, fontWeight: '600' },
  primary: { marginBottom: spacing.md },
  actions: { gap: spacing.md, marginBottom: spacing.lg },
  sectionTitle: { marginTop: spacing.lg, marginBottom: spacing.md },
  panelInner: { paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
  bottomActions: { gap: spacing.md, marginTop: spacing.xl },
});