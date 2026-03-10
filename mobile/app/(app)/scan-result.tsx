import axios from 'axios';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { simCardsApi } from '@/api/sim-cards.api';
import { useAuthStore } from '@/store/auth.store';

export default function ScanResultScreen() {
  const router = useRouter();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const params = useLocalSearchParams<{ iccid?: string }>();
  const iccid = params.iccid?.trim() ?? '';
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['scan-result', iccid],
    queryFn: () => simCardsApi.scanByIccid(iccid),
    enabled: Boolean(iccid),
  });

  const claimMutation = useMutation({
    mutationFn: (id: string) => simCardsApi.claimById(id),
    onSuccess: async () => {
      setActionError(null);
      setActionMessage('Kartica je uspješno zadužena.');
      await query.refetch();
    },
    onError: (error) => {
      setActionMessage(null);
      const data = axios.isAxiosError(error) ? error.response?.data : null;
      const msg = data?.message;
      const errMsg =
        typeof msg === 'string'
          ? msg
          : msg && typeof msg === 'object' && typeof (msg as { message?: string }).message === 'string'
            ? (msg as { message: string }).message
            : null;
      setActionError(errMsg ?? 'Zaduživanje nije uspjelo.');
    },
  });

  const result = query.data;
  const isAssignedToMe =
    result?.status === 'ASSIGNED' && result.assignedTo?.id === currentUserId;
  const isAssignedToAnother =
    result?.status === 'ASSIGNED' &&
    Boolean(result.assignedTo?.id) &&
    result.assignedTo?.id !== currentUserId;
  const canClaim = result?.status === 'AVAILABLE';

  const renderBody = () => {
    if (!iccid) {
      return <Text style={{ color: '#dc2626' }}>Nedostaje ICCID za pretragu.</Text>;
    }

    if (query.isLoading) {
      return (
        <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 20 }}>
          <ActivityIndicator size="large" />
        </View>
      );
    }

    if (query.isError) {
      const error = query.error;
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return <Text style={{ color: '#dc2626' }}>SIM kartica nije pronađena.</Text>;
      }

      if (axios.isAxiosError(error) && !error.response) {
        return (
          <Text style={{ color: '#dc2626' }}>Backend nije dostupan sa mobilnog uređaja.</Text>
        );
      }

      const data = axios.isAxiosError(error) ? error.response?.data : null;
      const msg = data?.message;
      const backendMessage =
        typeof msg === 'string'
          ? msg
          : msg && typeof msg === 'object' && typeof (msg as { message?: string }).message === 'string'
            ? (msg as { message: string }).message
            : null;
      return (
        <Text style={{ color: '#dc2626' }}>
          {backendMessage ?? 'Pretraga nije uspjela.'}
        </Text>
      );
    }

    if (!result) {
      return null;
    }

    return (
      <View
        style={{
          borderWidth: 1,
          borderColor: '#e2e8f0',
          borderRadius: 12,
          padding: 12,
          gap: 6,
        }}
      >
        <Text style={{ fontWeight: '700', fontSize: 16 }}>SIM info</Text>
        <Text>ICCID: {result.iccid}</Text>
        <Text>Status: {result.status}</Text>
        <View
          style={{
            backgroundColor: '#fef3c7',
            padding: 12,
            borderRadius: 8,
            borderWidth: 2,
            borderColor: '#f59e0b',
            marginVertical: 4,
          }}
        >
          <Text style={{ fontWeight: '700', fontSize: 14, color: '#92400e' }}>
            EPBIH IP – unesite u brojilo
          </Text>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#1f2937', marginTop: 4 }}>
            {result.ipAddress ?? '–'}
          </Text>
        </View>
        <Text>
          Zadužena kod:{' '}
          {result.assignedTo
            ? `${result.assignedTo.firstName} ${result.assignedTo.lastName}`
            : '-'}
        </Text>
        <Text>Telefon: {result.phoneNumber ?? '-'}</Text>
        <Text>APN: {result.apn ?? '-'}</Text>
        <Text>Isporuka: {result.shipment?.name ?? '-'}</Text>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: '700' }}>Rezultat skena</Text>
      <Text style={{ color: '#64748b' }}>ICCID: {iccid || '-'}</Text>

      {renderBody()}

      <Pressable
        disabled={!result || !canClaim || claimMutation.isPending}
        onPress={() => {
          if (!result) {
            return;
          }
          void claimMutation.mutate(result.id);
        }}
        style={{
          backgroundColor: !result || !canClaim ? '#94a3b8' : '#0f766e',
          padding: 12,
          borderRadius: 10,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#fff' }}>
          {claimMutation.isPending ? 'Zaduživanje...' : 'Zaduži karticu'}
        </Text>
      </Pressable>

      {isAssignedToMe ? (
        <>
          <Text style={{ color: '#15803d' }}>Kartica je već zadužena kod tebe.</Text>
          <Pressable
            onPress={() =>
              result && router.push({ pathname: '/create-record', params: { simCardId: result.id } })
            }
            style={{
              backgroundColor: '#0f766e',
              padding: 12,
              borderRadius: 10,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#fff' }}>Kreiraj zapisnik ugradnje</Text>
          </Pressable>
        </>
      ) : null}
      {isAssignedToAnother ? (
        <Text style={{ color: '#b45309' }}>Kartica je već zadužena kod drugog operatora.</Text>
      ) : null}
      {result && !canClaim && !isAssignedToMe && !isAssignedToAnother ? (
        <Text style={{ color: '#64748b' }}>
          Kartica nije u statusu `AVAILABLE` i ne može se zadužiti.
        </Text>
      ) : null}
      {actionMessage ? <Text style={{ color: '#15803d' }}>{actionMessage}</Text> : null}
      {actionError ? <Text style={{ color: '#dc2626' }}>{actionError}</Text> : null}

      <Pressable
        onPress={() => void query.refetch()}
        style={{
          backgroundColor: '#0f766e',
          padding: 12,
          borderRadius: 10,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#fff' }}>Osvježi</Text>
      </Pressable>

      <Pressable
        onPress={() => router.replace('/(app)/(tabs)/scan')}
        style={{
          backgroundColor: '#334155',
          padding: 12,
          borderRadius: 10,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#fff' }}>Novi scan</Text>
      </Pressable>
    </View>
  );
}
