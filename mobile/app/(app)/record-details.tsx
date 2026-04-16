import axios from 'axios';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { installationRecordsApi } from '@/api/installation-records.api';
import { meterTypeDefinitionsApi, type MeterTypeFieldItem } from '@/api/meter-type-definitions.api';
import { colors } from '@/theme/colors';

const statusLabels: Record<string, string> = {
  DRAFT: 'Nacrt',
  SENT: 'Poslano',
  SEND_FAILED: 'Greška pri slanju',
  SEP_ACTIVATED: 'SEP aktiviran',
  LEGACY_COMPLETED: 'Završeno (legacy)',
};

export default function RecordDetailsScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const recordId = params.id?.trim() ?? '';

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

  const meterTypeDefinitionId = recordQuery.data?.meter?.meterTypeDefinitionId?.trim() ?? '';
  const meterTypeFieldsQuery = useQuery({
    queryKey: ['meter-type-definitions', meterTypeDefinitionId, 'fields'],
    queryFn: () => meterTypeDefinitionsApi.listFields(meterTypeDefinitionId),
    enabled: Boolean(meterTypeDefinitionId),
  });

  const formatDynamicValue = (field: MeterTypeFieldItem, value: unknown): string => {
    const fallback = '–';
    if (value === undefined || value === null) {
      if (!field.isOperatorFillable && field.defaultValue != null && field.defaultValue.length > 0) {
        return field.defaultValue;
      }
      return fallback;
    }

    if (field.fieldType === 'BOOLEAN') {
      if (value === true || value === 'true') return 'Da';
      if (value === false || value === 'false') return 'Ne';
      return fallback;
    }

    if (field.fieldType === 'DATE') {
      const raw = String(value);
      const parsed = new Date(raw);
      return Number.isNaN(parsed.getTime()) ? raw : parsed.toLocaleDateString();
    }

    if (field.fieldType === 'NUMBER') {
      if (typeof value === 'number') return String(value);
      const s = String(value).trim();
      return s.length > 0 ? s : fallback;
    }

    const s = String(value).trim();
    return s.length > 0 ? s : fallback;
  };

  const retrySendMutation = useMutation({
    mutationFn: () => installationRecordsApi.retrySend(recordId),
    onSuccess: async () => {
      await recordQuery.refetch();
      await permissionsQuery.refetch();
      Alert.alert('Uspjeh', 'Zapisnik je ponovo poslan.');
    },
    onError: (err) => {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Ponovo slanje nije uspjelo.';
      Alert.alert('Greška', msg);
    },
  });

  const markSepMutation = useMutation({
    mutationFn: () => installationRecordsApi.markSepActivated(recordId),
    onSuccess: async () => {
      await recordQuery.refetch();
      await permissionsQuery.refetch();
      Alert.alert('Uspjeh', 'Zapisnik je označen kao SEP aktiviran.');
    },
    onError: (err) => {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Ažuriranje statusa nije uspjelo.';
      Alert.alert('Greška', msg);
    },
  });

  if (!recordId) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <Text style={{ color: '#dc2626' }}>Nedostaje ID zapisnika.</Text>
      </View>
    );
  }

  if (recordQuery.isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (recordQuery.isError || !recordQuery.data) {
    return (
      <View style={{ flex: 1, padding: 16, gap: 12 }}>
        <Text style={{ color: '#dc2626' }}>
          Ne mogu učitati detalje zapisnika.
        </Text>
        <Pressable
          onPress={() => void recordQuery.refetch()}
          style={{
            alignSelf: 'flex-start',
            backgroundColor: colors.primary,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 8,
          }}
        >
          <Text style={{ color: '#fff' }}>Pokušaj ponovo</Text>
        </Pressable>
      </View>
    );
  }

  const record = recordQuery.data;
  const canRetrySend = Boolean(permissionsQuery.data?.canRetrySend);
  const canMarkSepActivated = Boolean(permissionsQuery.data?.canMarkSepActivated);
  const showRetrySend = record.status === 'SEND_FAILED' && canRetrySend;
  const showMarkSep = record.status === 'SENT' && canMarkSepActivated;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 20, fontWeight: '700' }}>
          Zapisnik {record.recordNumber}
        </Text>
        <View
          style={{
            alignSelf: 'flex-start',
            marginTop: 4,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 999,
            backgroundColor: '#f1f5f9',
          }}
        >
          <Text style={{ fontSize: 12, color: '#475569' }}>
            {statusLabels[record.status] ?? record.status}
          </Text>
        </View>
      </View>

      <View
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          padding: 12,
          gap: 6,
        }}
      >
        <Text style={{ fontWeight: '600', color: '#0f172a' }}>SIM kartica</Text>
        <Text style={{ color: '#475569' }}>
          ICCID: {record.meter?.simCard?.iccid ?? '–'}
        </Text>
        <Text style={{ color: '#475569' }}>
          EPBIH IP: {record.meter?.simCard?.ipAddress ?? '–'}
        </Text>
        <Text style={{ color: '#475569' }}>
          Status SIM: {record.meter?.simCard?.status ?? '–'}
        </Text>
      </View>

      <View
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          padding: 12,
          gap: 6,
        }}
      >
        <Text style={{ fontWeight: '600', color: '#0f172a' }}>Brojilo</Text>
        <Text style={{ color: '#475569' }}>
          Brojilo: {record.meter?.serialNumber ?? '–'}
        </Text>
        <Text style={{ color: '#475569' }}>
          Tip brojila: {record.meter?.meterTypeDefinition?.name ?? '–'}
        </Text>
        <Text style={{ color: '#475569' }}>
          Adresa ugradnje: {record.meter?.installationAddress ?? '–'}
        </Text>
        <Text style={{ color: '#475569' }}>
          Grad / opština:{' '}
          {[record.meter?.city, record.meter?.municipality].filter(Boolean).join(', ') || '–'}
        </Text>
        <Text style={{ color: '#475569' }}>
          Datum ugradnje:{' '}
          {record.meter?.installationDate
            ? new Date(record.meter.installationDate).toLocaleDateString()
            : '–'}
        </Text>
      </View>

      {meterTypeDefinitionId ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 10,
            padding: 12,
            gap: 10,
          }}
        >
          <Text style={{ fontWeight: '600', color: colors.text }}>Dodatna polja</Text>

          {meterTypeFieldsQuery.isLoading ? (
            <View style={{ paddingVertical: 8 }}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : meterTypeFieldsQuery.isError ? (
            <Text style={{ color: '#dc2626' }}>Nije moguće učitati dodatna polja.</Text>
          ) : (
            (() => {
              const fields = Array.isArray(meterTypeFieldsQuery.data) ? meterTypeFieldsQuery.data : [];
              if (fields.length === 0) {
                return <Text style={{ color: colors.textMuted }}>Nema dodatnih polja.</Text>;
              }

              const values = record.meter?.dynamicFieldValues ?? {};

              return (
                <View style={{ gap: 10 }}>
                  {fields
                    .slice()
                    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                    .map((f) => (
                      <View key={f.id} style={{ gap: 2 }}>
                        <Text style={{ fontWeight: '600', color: colors.text }}>
                          {f.label}
                        </Text>
                        <Text style={{ color: colors.textMuted }}>
                          {formatDynamicValue(f, (values as Record<string, unknown>)[f.name])}
                        </Text>
                      </View>
                    ))}
                </View>
              );
            })()
          )}
        </View>
      ) : null}

      <View
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          padding: 12,
          gap: 6,
        }}
      >
        <Text style={{ fontWeight: '600', color: '#0f172a' }}>Lokacija</Text>
        <Text style={{ color: '#475569' }}>
          GPS širina: {record.meter?.latitude != null ? String(record.meter.latitude) : '–'}
        </Text>
        <Text style={{ color: '#475569' }}>
          GPS dužina: {record.meter?.longitude != null ? String(record.meter.longitude) : '–'}
        </Text>
        {record.meter?.latitude != null && record.meter?.longitude != null && (
          <Pressable
            onPress={() => {
              const lat = record.meter?.latitude;
              const lon = record.meter?.longitude;
              if (lat == null || lon == null) return;

              const label =
                record.meter?.installationAddress && record.meter.installationAddress.trim().length > 0
                  ? record.meter.installationAddress
                  : `Zapisnik ${record.recordNumber}`;
              const encodedLabel = encodeURIComponent(label);

              const googleMapsAppUrl = `comgooglemaps://?q=${lat},${lon}(${encodedLabel})`;
              const googleMapsWebUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}&query_place=${encodedLabel}`;

              Linking.canOpenURL(googleMapsAppUrl)
                .then((supported) => {
                  const url = supported ? googleMapsAppUrl : googleMapsWebUrl;
                  return Linking.openURL(url);
                })
                .catch(() => {
                  void Linking.openURL(googleMapsWebUrl);
                });
            }}
            style={{
              marginTop: 6,
              alignSelf: 'flex-start',
              backgroundColor: colors.primary,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>
              Otvori lokaciju u Google Maps
            </Text>
          </Pressable>
        )}
      </View>

      <View
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          padding: 12,
          gap: 6,
        }}
      >
        <Text style={{ fontWeight: '600', color: '#0f172a' }}>Statusi i napomene</Text>
        <Text style={{ color: '#475569' }}>
          Instalirao:{' '}
          {record.installedBy
            ? `${record.installedBy.firstName} ${record.installedBy.lastName}`
            : '–'}
        </Text>
        {record.notes ? (
          <Text style={{ color: '#475569' }}>Napomena: {record.notes}</Text>
        ) : null}
        {Array.isArray(record.photos) && record.photos.length > 0 ? (
          <Text style={{ color: '#475569' }}>
            Fotografije: {record.photos.length} kom (detaljan pregled trenutno je dostupan na
            web aplikaciji).
          </Text>
        ) : null}
      </View>

      {(showRetrySend || showMarkSep) && (
        <View
          style={{
            marginTop: 4,
            backgroundColor: '#fef3c7',
            borderColor: '#f59e0b',
            borderWidth: 1,
            borderRadius: 8,
            padding: 12,
            gap: 8,
          }}
        >
          {showRetrySend && (
            <>
              <Text style={{ color: '#92400e', fontWeight: '600' }}>
                Slanje emaila nije uspjelo. Pokušajte ponovo.
              </Text>
              <Pressable
                onPress={() => retrySendMutation.mutate()}
                disabled={retrySendMutation.isPending}
                style={{
                  backgroundColor: colors.primary,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 8,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>
                  {retrySendMutation.isPending ? 'Slanje...' : 'Ponovo pošalji'}
                </Text>
              </Pressable>
            </>
          )}

          {showMarkSep && (
            <>
              <Text style={{ color: '#92400e', fontWeight: '600' }}>
                Nakon potvrde u SEP, označite zapisnik kao SEP aktiviran.
              </Text>
              <Pressable
                onPress={() => {
                  Alert.alert(
                    'Potvrda',
                    'Da li ste sigurni da želite označiti SEP kao aktiviran?',
                    [
                      { text: 'Odustani', style: 'cancel' },
                      { text: 'Označi', onPress: () => markSepMutation.mutate() },
                    ],
                  );
                }}
                disabled={markSepMutation.isPending}
                style={{
                  backgroundColor: colors.primary,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 8,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>
                  {markSepMutation.isPending ? 'Ažuriranje...' : 'Označi SEP aktiviranim'}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      )}
    </ScrollView>
  );
}
