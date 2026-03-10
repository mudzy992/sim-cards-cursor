import axios from 'axios';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
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
    <View style={{ flex: 1, padding: 16, gap: 10 }}>
      <Text style={{ fontSize: 20, fontWeight: '700' }}>
        Zapisnik {record.recordNumber}
      </Text>
      <Text style={{ color: '#64748b' }}>
        Status: {statusLabels[record.status] ?? record.status}
      </Text>
      <Text style={{ color: '#64748b' }}>
        Brojilo: {record.meter?.serialNumber ?? '–'} •{' '}
        {record.meter?.meterTypeDefinition?.name ?? '–'}
      </Text>
      <Text style={{ color: '#64748b' }}>
        SIM: {record.meter?.simCard?.iccid ?? '–'}
      </Text>

      {needsManualSubmit && (
        <View
          style={{
            marginTop: 8,
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
    </View>
  );
}
