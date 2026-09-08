import axios from 'axios';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { installationRecordsApi, type RecordStatus } from '@/api/installation-records.api';
import { meterTypeDefinitionsApi, type MeterTypeFieldItem } from '@/api/meter-type-definitions.api';
import { palette, spacing, type } from '@/theme/tokens';
import { ScreenTitleBar } from '@/components/ui/ScreenTitleBar';
import { StatusBadge, type StatusTone } from '@/components/ui/StatusBadge';
import { Section } from '@/components/ui/Section';
import { Panel } from '@/components/ui/Panel';
import { ListRow } from '@/components/ui/ListRow';
import { ActionButton } from '@/components/ui/ActionButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRows } from '@/components/ui/Skeleton';

const statusMeta: Record<RecordStatus, { label: string; tone: StatusTone }> = {
  DRAFT: { label: 'Nacrt', tone: 'neutral' }, SENT: { label: 'Poslano', tone: 'info' },
  SEND_FAILED: { label: 'Greška pri slanju', tone: 'danger' },
  SEP_ACTIVATED: { label: 'SEP aktiviran', tone: 'success' },
  LEGACY_COMPLETED: { label: 'Završeno', tone: 'success' },
};

export default function RecordDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const recordId = (typeof params.id === 'string' ? params.id : params.id?.[0])?.trim() ?? '';
  const recordQuery = useQuery({ queryKey: ['mobile-record-details', recordId], queryFn: () => installationRecordsApi.getById(recordId), enabled: Boolean(recordId) });
  const permissionsQuery = useQuery({ queryKey: ['mobile-record-permissions', recordId], queryFn: () => installationRecordsApi.getPermissions(recordId), enabled: Boolean(recordId) });
  const record = recordQuery.data;
  const meterTypeId = record?.meter?.meterTypeDefinitionId?.trim() ?? '';
  const fieldsQuery = useQuery({ queryKey: ['meter-type-definitions', meterTypeId, 'fields'], queryFn: () => meterTypeDefinitionsApi.listFields(meterTypeId), enabled: Boolean(meterTypeId) });
  const snapshot = record?.kind === 'METER_REPLACEMENT' && record.demountedMeterSnapshot
    ? record.demountedMeterSnapshot as Record<string, unknown> : null;
  const demountedTypeId = typeof snapshot?.meterTypeDefinitionId === 'string' ? snapshot.meterTypeDefinitionId : '';
  const demountedTypeQuery = useQuery({ queryKey: ['mobile-meter-type-definition', demountedTypeId], queryFn: () => meterTypeDefinitionsApi.get(demountedTypeId), enabled: Boolean(demountedTypeId) });
  const demountedFieldsQuery = useQuery({ queryKey: ['meter-type-definitions', demountedTypeId, 'fields'], queryFn: () => meterTypeDefinitionsApi.listFields(demountedTypeId), enabled: Boolean(demountedTypeId) });

  const retrySend = useMutation({
    mutationFn: () => installationRecordsApi.retrySend(recordId),
    onSuccess: async () => { await Promise.all([recordQuery.refetch(), permissionsQuery.refetch()]); Alert.alert('Uspjeh', 'Zapisnik je ponovo poslan.'); },
    onError: (error) => Alert.alert('Greška', getMessage(error, 'Ponovno slanje nije uspjelo.')),
  });
  const markSep = useMutation({
    mutationFn: () => installationRecordsApi.markSepActivated(recordId),
    onSuccess: async () => { await Promise.all([recordQuery.refetch(), permissionsQuery.refetch()]); Alert.alert('Uspjeh', 'Zapisnik je označen kao SEP aktiviran.'); },
    onError: (error) => Alert.alert('Greška', getMessage(error, 'Ažuriranje statusa nije uspjelo.')),
  });

  if (!recordId) return <SafeAreaView style={styles.root}><EmptyState icon="alert-circle-outline" title="Nedostaje ID zapisnika" /></SafeAreaView>;
  if (recordQuery.isLoading) return <SafeAreaView style={styles.root}><ScreenTitleBar title="Zapisnik" onBack={() => router.back()} /><View style={styles.loading}><SkeletonRows count={8} /></View></SafeAreaView>;
  if (recordQuery.isError || !record) return <SafeAreaView style={styles.root}><ScreenTitleBar title="Zapisnik" onBack={() => router.back()} />
    <EmptyState icon="cloud-offline-outline" title="Detalji nisu dostupni" description="Ne mogu učitati zapisnik."
      actionLabel="Pokušaj ponovo" onAction={() => void recordQuery.refetch()} /></SafeAreaView>;

  const status = statusMeta[record.status] ?? { label: record.status, tone: 'neutral' as const };
  const showRetry = record.status === 'SEND_FAILED' && Boolean(permissionsQuery.data?.canRetrySend);
  const showSep = record.status === 'SENT' && Boolean(permissionsQuery.data?.canMarkSepActivated);
  const values = record.meter?.dynamicFieldValues ?? {};
  const fields = Array.isArray(fieldsQuery.data) ? fieldsQuery.data : [];
  const demountedFields = Array.isArray(demountedFieldsQuery.data) ? demountedFieldsQuery.data : [];
  const demountedValues = snapshot?.dynamicFieldValues && typeof snapshot.dynamicFieldValues === 'object'
    ? snapshot.dynamicFieldValues as Record<string, unknown> : {};

  const openMaps = () => {
    const lat = record.meter?.latitude;
    const lon = record.meter?.longitude;
    if (lat == null || lon == null) return;
    const label = record.meter?.installationAddress?.trim() || `Zapisnik ${record.recordNumber}`;
    const encoded = encodeURIComponent(label);
    const appUrl = `comgooglemaps://?q=${lat},${lon}(${encoded})`;
    const webUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}&query_place=${encoded}`;
    void Linking.canOpenURL(appUrl).then((supported) => Linking.openURL(supported ? appUrl : webUrl)).catch(() => Linking.openURL(webUrl));
  };

  return <SafeAreaView style={styles.root} edges={['top']}>
    <ScreenTitleBar title={`Zapisnik ${record.recordNumber}`} subtitle={record.kind === 'METER_REPLACEMENT' ? 'Zamjena brojila' : 'Novi priključak'} onBack={() => router.back()} />
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.statusRow}><StatusBadge tone={status.tone} label={status.label} showDot /></View>

      {snapshot ? <Section label="Demontirano brojilo">
        <Panel padding="none"><View style={styles.panelInner}>
          <ListRow title="Serijski broj" value={stringValue(snapshot.serialNumber)} valueMono />
          <ListRow title="Tip" value={demountedTypeQuery.data?.name ?? '—'} divider />
          <ListRow title="Proizvođač / model" value={[demountedTypeQuery.data?.manufacturer, demountedTypeQuery.data?.model].filter(Boolean).join(' · ') || '—'} divider />
          <ListRow title="Godina" value={stringValue(snapshot.year)} divider />
          <ListRow title="Baždarenje" value={stringValue(snapshot.calibrationYear)} divider />
          <ListRow title="Integrisana SIM" value={snapshot.hadIntegratedSim === true ? 'Da' : snapshot.hadIntegratedSim === false ? 'Ne' : '—'} divider />
          {demountedFields.map((field) => <ListRow key={field.id} title={field.label} value={formatDynamicValue(field, demountedValues[field.name])} divider />)}
          {typeof snapshot.noSimNote === 'string' && snapshot.noSimNote ? <ListRow title="Napomena SIM" value={snapshot.noSimNote} divider /> : null}
          {typeof snapshot.notes === 'string' && snapshot.notes ? <ListRow title="Napomena" value={snapshot.notes} divider /> : null}
        </View></Panel>
      </Section> : null}

      <Section label="SIM kartica">
        <Panel padding="none"><View style={styles.panelInner}>
          <ListRow title="ICCID" value={record.meter?.simCard?.iccid ?? '—'} valueMono />
          <ListRow title="EPBIH IP" value={record.meter?.simCard?.ipAddress ?? '—'} valueMono divider />
          <ListRow title="Status" value={record.meter?.simCard?.status ?? '—'} divider />
        </View></Panel>
      </Section>

      <Section label={record.kind === 'METER_REPLACEMENT' ? 'Novo brojilo' : 'Brojilo'}>
        <Panel padding="none"><View style={styles.panelInner}>
          <ListRow title="Serijski broj" value={record.meter?.serialNumber ?? '—'} valueMono />
          <ListRow title="Tip" value={record.meter?.meterTypeDefinition?.name ?? '—'} divider />
          <ListRow title="Adresa" value={record.meter?.installationAddress ?? '—'} divider />
          <ListRow title="Grad / općina" value={[record.meter?.city, record.meter?.municipality].filter(Boolean).join(', ') || '—'} divider />
          <ListRow title="Datum ugradnje" value={record.meter?.installationDate ? new Date(record.meter.installationDate).toLocaleDateString('bs-BA') : '—'} divider />
          {fields.map((field) => <ListRow key={field.id} title={field.label} value={formatDynamicValue(field, (values as Record<string, unknown>)[field.name])} divider />)}
        </View></Panel>
      </Section>

      <Section label="Lokacija">
        <Panel padding="none"><View style={styles.panelInner}>
          <ListRow title="GPS širina" value={record.meter?.latitude != null ? String(record.meter.latitude) : '—'} valueMono />
          <ListRow title="GPS dužina" value={record.meter?.longitude != null ? String(record.meter.longitude) : '—'} valueMono divider />
        </View></Panel>
        {record.meter?.latitude != null && record.meter?.longitude != null ? <ActionButton title="Otvori u Google Maps" icon="map-outline" variant="secondary" onPress={openMaps} style={styles.mapButton} /> : null}
      </Section>

      <Section label="Evidencija">
        <Panel padding="none"><View style={styles.panelInner}>
          <ListRow title="Instalirao" value={record.installedBy ? `${record.installedBy.firstName} ${record.installedBy.lastName}` : '—'} />
          <ListRow title="Napomena" value={record.notes ?? '—'} divider />
          <ListRow title="Fotografije" value={`${Array.isArray(record.photos) ? record.photos.length : 0} kom`} divider />
        </View></Panel>
      </Section>

      {showRetry ? <Panel tone="danger" style={styles.actionPanel}><Text style={type.bodyStrong}>Slanje emaila nije uspjelo</Text>
        <Text style={[type.caption, styles.actionText]}>Provjerite mrežu i pokušajte ponovo.</Text>
        <ActionButton title="Ponovo pošalji" icon="mail-outline" onPress={() => retrySend.mutate()} loading={retrySend.isPending} /></Panel> : null}
      {showSep ? <Panel tone="info" style={styles.actionPanel}><Text style={type.bodyStrong}>Potvrda SEP aktivacije</Text>
        <Text style={[type.caption, styles.actionText]}>Nakon potvrde u SEP označite zapisnik aktiviranim.</Text>
        <ActionButton title="Označi SEP aktiviranim" icon="checkmark-circle-outline" loading={markSep.isPending}
          onPress={() => Alert.alert('Potvrda', 'Označiti SEP kao aktiviran?', [
            { text: 'Odustani', style: 'cancel' }, { text: 'Označi', onPress: () => markSep.mutate() },
          ])} /></Panel> : null}
    </ScrollView>
  </SafeAreaView>;
}

function stringValue(value: unknown): string { return value == null ? '—' : String(value); }
function getMessage(error: unknown, fallback: string): string {
  return axios.isAxiosError(error) && error.response?.data?.message ? String(error.response.data.message) : fallback;
}
function formatDynamicValue(field: MeterTypeFieldItem, value: unknown): string {
  if (value == null) return !field.isOperatorFillable && field.defaultValue ? field.defaultValue : '—';
  if (field.fieldType === 'BOOLEAN') return value === true || value === 'true' ? 'Da' : value === false || value === 'false' ? 'Ne' : '—';
  if (field.fieldType === 'DATE') { const date = new Date(String(value)); return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('bs-BA'); }
  const text = String(value).trim();
  return text || '—';
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.background },
  loading: { padding: spacing.xl },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  statusRow: { marginBottom: spacing.xl },
  panelInner: { paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
  mapButton: { marginTop: spacing.md },
  actionPanel: { marginBottom: spacing.lg },
  actionText: { marginTop: spacing.xs, marginBottom: spacing.lg },
});