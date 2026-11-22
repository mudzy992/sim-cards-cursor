import axios from 'axios';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  installationRecordsApi,
  type RecordStatus,
} from '@/api/installation-records.api';
import {
  meterTypeDefinitionsApi,
  type MeterTypeFieldItem,
} from '@/api/meter-type-definitions.api';
import { useTranslation } from '@/i18n/i18n.store';
import {
  spacing,
  useTheme,
  useThemedStyles,
  type ThemePalette,
} from '@/theme/tokens';
import { ScreenTitleBar } from '@/components/ui/ScreenTitleBar';
import { StatusBadge, type StatusTone } from '@/components/ui/StatusBadge';
import { Section } from '@/components/ui/Section';
import { Panel } from '@/components/ui/Panel';
import { ListRow } from '@/components/ui/ListRow';
import { ActionButton } from '@/components/ui/ActionButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { openInExternalMaps } from '@/utils/geo';

const statusConfig: Record<RecordStatus, { key: string; tone: StatusTone }> = {
  DRAFT: { key: 'mobile.records.statusDraft', tone: 'neutral' },
  SENT: { key: 'mobile.records.statusSent', tone: 'info' },
  SEND_FAILED: { key: 'mobile.records.statusSendFailed', tone: 'danger' },
  SEP_ACTIVATED: { key: 'mobile.records.statusSepActivated', tone: 'success' },
  LEGACY_COMPLETED: { key: 'mobile.records.statusCompleted', tone: 'success' },
};

export default function RecordDetailsScreen() {
  const router = useRouter();
  const { type } = useTheme();
  const { t, language } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const recordId =
    (typeof params.id === 'string' ? params.id : params.id?.[0])?.trim() ?? '';
  const recordQuery = useQuery({
    queryKey: ['mobile-record-details', recordId],
    queryFn: () => installationRecordsApi.getById(recordId),
    enabled: Boolean(recordId),
  });
  const permissionsQuery = useQuery({
    queryKey: ['mobile-record-permissions', recordId],
    queryFn: () => installationRecordsApi.getPermissions(recordId),
    enabled: Boolean(recordId),
  });
  const record = recordQuery.data;
  const meterTypeId = record?.meter?.meterTypeDefinitionId?.trim() ?? '';
  const fieldsQuery = useQuery({
    queryKey: ['meter-type-definitions', meterTypeId, 'fields'],
    queryFn: () => meterTypeDefinitionsApi.listFields(meterTypeId),
    enabled: Boolean(meterTypeId),
  });
  const snapshot =
    record?.kind === 'METER_REPLACEMENT' && record.demountedMeterSnapshot
      ? (record.demountedMeterSnapshot as Record<string, unknown>)
      : null;
  const demountedTypeId =
    typeof snapshot?.meterTypeDefinitionId === 'string'
      ? snapshot.meterTypeDefinitionId
      : '';
  const demountedTypeQuery = useQuery({
    queryKey: ['mobile-meter-type-definition', demountedTypeId],
    queryFn: () => meterTypeDefinitionsApi.get(demountedTypeId),
    enabled: Boolean(demountedTypeId),
  });
  const demountedFieldsQuery = useQuery({
    queryKey: ['meter-type-definitions', demountedTypeId, 'fields'],
    queryFn: () => meterTypeDefinitionsApi.listFields(demountedTypeId),
    enabled: Boolean(demountedTypeId),
  });

  const retrySend = useMutation({
    mutationFn: () => installationRecordsApi.retrySend(recordId),
    onSuccess: async () => {
      await Promise.all([recordQuery.refetch(), permissionsQuery.refetch()]);
      Alert.alert(
        t('mobile.common.success'),
        t('mobile.records.details.retrySendSuccess'),
      );
    },
    onError: (error) =>
      Alert.alert(
        t('mobile.common.error'),
        getMessage(error, t('mobile.records.details.retrySendError')),
      ),
  });
  const markSep = useMutation({
    mutationFn: () => installationRecordsApi.markSepActivated(recordId),
    onSuccess: async () => {
      await Promise.all([recordQuery.refetch(), permissionsQuery.refetch()]);
      Alert.alert(
        t('mobile.common.success'),
        t('mobile.records.details.markSepSuccess'),
      );
    },
    onError: (error) =>
      Alert.alert(
        t('mobile.common.error'),
        getMessage(error, t('mobile.records.details.markSepError')),
      ),
  });

  const locale = language === 'en' ? 'en-GB' : 'bs-BA';

  if (!recordId) {
    return (
      <SafeAreaView style={styles.root}>
        <EmptyState
          icon="alert-circle-outline"
          title={t('mobile.records.details.missingId')}
        />
      </SafeAreaView>
    );
  }
  if (recordQuery.isLoading) {
    return (
      <SafeAreaView style={styles.root}>
        <ScreenTitleBar
          title={t('mobile.records.details.screenTitle')}
          onBack={() => router.back()}
        />
        <View style={styles.loading}>
          <SkeletonRows count={8} />
        </View>
      </SafeAreaView>
    );
  }
  if (recordQuery.isError || !record) {
    return (
      <SafeAreaView style={styles.root}>
        <ScreenTitleBar
          title={t('mobile.records.details.screenTitle')}
          onBack={() => router.back()}
        />
        <EmptyState
          icon="cloud-offline-outline"
          title={t('mobile.records.details.unavailableTitle')}
          description={t('mobile.records.details.unavailableDesc')}
          actionLabel={t('mobile.common.retry')}
          onAction={() => void recordQuery.refetch()}
        />
      </SafeAreaView>
    );
  }

  const cfg = statusConfig[record.status];
  const statusLabel = cfg ? t(cfg.key) : record.status;
  const statusTone: StatusTone = cfg ? cfg.tone : 'neutral';
  const showRetry =
    record.status === 'SEND_FAILED' &&
    Boolean(permissionsQuery.data?.canRetrySend);
  const showSep =
    record.status === 'SENT' &&
    Boolean(permissionsQuery.data?.canMarkSepActivated);
  const values = record.meter?.dynamicFieldValues ?? {};
  const fields = Array.isArray(fieldsQuery.data) ? fieldsQuery.data : [];
  const demountedFields = Array.isArray(demountedFieldsQuery.data)
    ? demountedFieldsQuery.data
    : [];
  const demountedValues =
    snapshot?.dynamicFieldValues &&
    typeof snapshot.dynamicFieldValues === 'object'
      ? (snapshot.dynamicFieldValues as Record<string, unknown>)
      : {};

  const openMaps = () => {
    const lat = record.meter?.latitude;
    const lon = record.meter?.longitude;
    if (lat == null || lon == null) return;
    const label =
      record.meter?.installationAddress?.trim() ||
      t('mobile.records.details.titleWithNumber', {
        number: record.recordNumber,
      });
    void openInExternalMaps({ latitude: lat, longitude: lon }, label);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenTitleBar
        title={t('mobile.records.details.titleWithNumber', {
          number: record.recordNumber,
        })}
        subtitle={
          record.kind === 'METER_REPLACEMENT'
            ? t('mobile.records.details.kindReplacement')
            : t('mobile.records.details.kindNew')
        }
        onBack={() => router.back()}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statusRow}>
          <StatusBadge tone={statusTone} label={statusLabel} showDot />
        </View>

        {snapshot ? (
          <Section label={t('mobile.records.details.demountedSection')}>
            <Panel padding="none">
              <View style={styles.panelInner}>
                <ListRow
                  title={t('mobile.tasks.install.serialNumber')}
                  value={stringValue(snapshot.serialNumber)}
                  valueMono
                />
                <ListRow
                  title={t('mobile.tasks.install.meterType')}
                  value={demountedTypeQuery.data?.name ?? '—'}
                  divider
                />
                <ListRow
                  title={t('mobile.records.details.manufacturerModel')}
                  value={
                    [
                      demountedTypeQuery.data?.manufacturer,
                      demountedTypeQuery.data?.model,
                    ]
                      .filter(Boolean)
                      .join(' · ') || '—'
                  }
                  divider
                />
                <ListRow
                  title={t('mobile.records.details.year')}
                  value={stringValue(snapshot.year)}
                  divider
                />
                <ListRow
                  title={t('mobile.records.details.calibration')}
                  value={stringValue(snapshot.calibrationYear)}
                  divider
                />
                <ListRow
                  title={t('mobile.records.details.integratedSim')}
                  value={
                    snapshot.hadIntegratedSim === true
                      ? t('mobile.common.yes')
                      : snapshot.hadIntegratedSim === false
                        ? t('mobile.common.no')
                        : '—'
                  }
                  divider
                />
                {demountedFields.map((field) => (
                  <ListRow
                    key={field.id}
                    title={field.label}
                    value={formatDynamicValue(
                      field,
                      demountedValues[field.name],
                      t,
                      locale,
                    )}
                    divider
                  />
                ))}
                {typeof snapshot.noSimNote === 'string' && snapshot.noSimNote ? (
                  <ListRow
                    title={t('mobile.records.details.simNote')}
                    value={snapshot.noSimNote}
                    divider
                  />
                ) : null}
                {typeof snapshot.notes === 'string' && snapshot.notes ? (
                  <ListRow
                    title={t('mobile.records.details.note')}
                    value={snapshot.notes}
                    divider
                  />
                ) : null}
              </View>
            </Panel>
          </Section>
        ) : null}

        <Section label={t('mobile.records.details.simSection')}>
          <Panel padding="none">
            <View style={styles.panelInner}>
              <ListRow
                title="ICCID"
                value={record.meter?.simCard?.iccid ?? '—'}
                valueMono
              />
              <ListRow
                title="EPBIH IP"
                value={record.meter?.simCard?.ipAddress ?? '—'}
                valueMono
                divider
              />
              <ListRow
                title={t('mobile.records.details.status')}
                value={record.meter?.simCard?.status ?? '—'}
                divider
              />
            </View>
          </Panel>
        </Section>

        <Section
          label={
            record.kind === 'METER_REPLACEMENT'
              ? t('mobile.records.details.newMeterSection')
              : t('mobile.records.details.meterSection')
          }
        >
          <Panel padding="none">
            <View style={styles.panelInner}>
              <ListRow
                title={t('mobile.tasks.install.serialNumber')}
                value={record.meter?.serialNumber ?? '—'}
                valueMono
              />
              <ListRow
                title={t('mobile.tasks.install.meterType')}
                value={record.meter?.meterTypeDefinition?.name ?? '—'}
                divider
              />
              <ListRow
                title={t('mobile.tasks.install.address')}
                value={record.meter?.installationAddress ?? '—'}
                divider
              />
              <ListRow
                title={t('mobile.records.details.cityMunicipality')}
                value={
                  [record.meter?.city, record.meter?.municipality]
                    .filter(Boolean)
                    .join(', ') || '—'
                }
                divider
              />
              <ListRow
                title={t('mobile.records.details.installDate')}
                value={
                  record.meter?.installationDate
                    ? new Date(
                        record.meter.installationDate,
                      ).toLocaleDateString(locale)
                    : '—'
                }
                divider
              />
              {fields.map((field) => (
                <ListRow
                  key={field.id}
                  title={field.label}
                  value={formatDynamicValue(
                    field,
                    (values as Record<string, unknown>)[field.name],
                    t,
                    locale,
                  )}
                  divider
                />
              ))}
            </View>
          </Panel>
        </Section>

        <Section label={t('mobile.records.details.locationSection')}>
          <Panel padding="none">
            <View style={styles.panelInner}>
              <ListRow
                title={t('mobile.records.details.gpsLat')}
                value={
                  record.meter?.latitude != null
                    ? String(record.meter.latitude)
                    : '—'
                }
                valueMono
              />
              <ListRow
                title={t('mobile.records.details.gpsLon')}
                value={
                  record.meter?.longitude != null
                    ? String(record.meter.longitude)
                    : '—'
                }
                valueMono
                divider
              />
            </View>
          </Panel>
          {record.meter?.latitude != null && record.meter?.longitude != null ? (
            <ActionButton
              testID="record-details-maps-btn"
              title={t('mobile.records.details.openMaps')}
              icon="map-outline"
              variant="secondary"
              onPress={openMaps}
              style={styles.mapButton}
            />
          ) : null}
        </Section>

        <Section label={t('mobile.records.details.evidenceSection')}>
          <Panel padding="none">
            <View style={styles.panelInner}>
              <ListRow
                title={t('mobile.records.details.installedBy')}
                value={
                  record.installedBy
                    ? `${record.installedBy.firstName} ${record.installedBy.lastName}`
                    : '—'
                }
              />
              <ListRow
                title={t('mobile.records.details.note')}
                value={record.notes ?? '—'}
                divider
              />
              <ListRow
                title={t('mobile.records.details.photos')}
                value={t('mobile.records.details.photosCount', {
                  count: Array.isArray(record.photos) ? record.photos.length : 0,
                })}
                divider
              />
            </View>
          </Panel>
        </Section>

        {showRetry ? (
          <Panel tone="danger" style={styles.actionPanel}>
            <Text style={type.bodyStrong}>
              {t('mobile.records.details.emailFailedTitle')}
            </Text>
            <Text style={[type.caption, styles.actionText]}>
              {t('mobile.records.details.emailFailedBody')}
            </Text>
            <ActionButton
              testID="record-details-retry-send-btn"
              title={t('mobile.records.details.retrySend')}
              icon="mail-outline"
              onPress={() => retrySend.mutate()}
              loading={retrySend.isPending}
            />
          </Panel>
        ) : null}
        {showSep ? (
          <Panel tone="info" style={styles.actionPanel}>
            <Text style={type.bodyStrong}>
              {t('mobile.records.details.sepTitle')}
            </Text>
            <Text style={[type.caption, styles.actionText]}>
              {t('mobile.records.details.sepBody')}
            </Text>
            <ActionButton
              testID="record-details-mark-sep-btn"
              title={t('mobile.records.details.markSep')}
              icon="checkmark-circle-outline"
              loading={markSep.isPending}
              onPress={() =>
                Alert.alert(
                  t('mobile.records.details.sepConfirmTitle'),
                  t('mobile.records.details.sepConfirmMessage'),
                  [
                    { text: t('mobile.common.cancel'), style: 'cancel' },
                    {
                      text: t('mobile.records.details.markSepAction'),
                      onPress: () => markSep.mutate(),
                    },
                  ],
                )
              }
            />
          </Panel>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function stringValue(value: unknown): string {
  return value == null ? '—' : String(value);
}
function getMessage(error: unknown, fallback: string): string {
  return axios.isAxiosError(error) && error.response?.data?.message
    ? String(error.response.data.message)
    : fallback;
}
function formatDynamicValue(
  field: MeterTypeFieldItem,
  value: unknown,
  t: (key: string) => string,
  locale: string,
): string {
  if (value == null) {
    return !field.isOperatorFillable && field.defaultValue
      ? field.defaultValue
      : '—';
  }
  if (field.fieldType === 'BOOLEAN') {
    return value === true || value === 'true'
      ? t('mobile.common.yes')
      : value === false || value === 'false'
        ? t('mobile.common.no')
        : '—';
  }
  if (field.fieldType === 'DATE') {
    const date = new Date(String(value));
    return Number.isNaN(date.getTime())
      ? String(value)
      : date.toLocaleDateString(locale);
  }
  const text = String(value).trim();
  return text || '—';
}

const createStyles = (palette: ThemePalette) => ({
  root: { flex: 1, backgroundColor: palette.background },
  loading: { padding: spacing.xl },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  statusRow: { marginBottom: spacing.xl },
  panelInner: { paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
  mapButton: { marginTop: spacing.md },
  actionPanel: { marginBottom: spacing.lg },
  actionText: { marginTop: spacing.xs, marginBottom: spacing.lg },
});
