import axios from 'axios';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { installationRecordsApi } from '@/api/installation-records.api';

const statusLabels: Record<string, string> = {
  DRAFT: 'Nacrt',
  PENDING: 'Čeka odobrenje',
  SUBMIT_FAILED: 'Greška pri slanju',
  REJECTED: 'Odbijen',
  WAITING_SEP_ACTIVATION: 'Čeka aktivaciju SEP',
  ACTIVATED_IN_SEP: 'Aktivirano u SEP',
  SENT: 'Poslano',
};

export default function RecordDetailsScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const recordId = params.id?.trim() ?? '';

  const recordQuery = useQuery({
    queryKey: ['mobile-record-details', recordId],
    queryFn: () => installationRecordsApi.getById(recordId),
    enabled: Boolean(recordId),
  });

  const submitMutation = useMutation({
    mutationFn: () => installationRecordsApi.submitForApproval(recordId),
    onSuccess: async () => {
      await recordQuery.refetch();
      Alert.alert('Uspjeh', 'Zapisnik je poslan na odobrenje.');
    },
    onError: (err) => {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Slanje na odobrenje nije uspjelo.';
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
        <ActivityIndicator size="large" color="#0f766e" />
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
            backgroundColor: '#0f766e',
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
  const needsManualSubmit =
    record.status === 'DRAFT' || record.status === 'SUBMIT_FAILED';

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
          borderColor: '#e2e8f0',
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
          borderColor: '#e2e8f0',
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

      <View
        style={{
          borderWidth: 1,
          borderColor: '#e2e8f0',
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
              backgroundColor: '#0f766e',
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
          borderColor: '#e2e8f0',
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
        {record.approvedBy && (
          <Text style={{ color: '#475569' }}>
            Odobrio: {record.approvedBy.firstName} {record.approvedBy.lastName}
          </Text>
        )}
        {record.rejectionReason ? (
          <Text style={{ color: '#b91c1c' }}>Razlog odbijanja: {record.rejectionReason}</Text>
        ) : null}
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

      {needsManualSubmit && (
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
          <Text style={{ color: '#92400e', fontWeight: '600' }}>
            Ukoliko zapisnik nije poslan automatski, pošaljite ga ručno.
          </Text>
          <Pressable
            onPress={() => submitMutation.mutate()}
            disabled={submitMutation.isPending}
            style={{
              backgroundColor: '#0f766e',
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 8,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>
              {submitMutation.isPending ? 'Slanje...' : 'Pošalji na odobrenje'}
            </Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}
