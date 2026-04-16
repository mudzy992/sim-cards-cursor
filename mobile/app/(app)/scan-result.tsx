import axios from 'axios';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { simCardsApi, type MobileSimCard } from '@/api/sim-cards.api';
import { useAuthStore } from '@/store/auth.store';
import { colors } from '@/theme/colors';

export default function ScanResultScreen() {
  const router = useRouter();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const params = useLocalSearchParams<{ iccid?: string }>();
  const iccid = params.iccid?.trim() ?? '';
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [justClaimed, setJustClaimed] = useState(false);

  useEffect(() => {
    setActionMessage(null);
    setActionError(null);
    setJustClaimed(false);
  }, [iccid]);

  const query = useQuery({
    queryKey: ['scan-result', iccid],
    queryFn: () => simCardsApi.scanByIccidWithOffline(iccid),
    enabled: Boolean(iccid),
  });

  const claimMutation = useMutation({
    mutationFn: (id: string) => simCardsApi.claimById(id),
    onSuccess: async () => {
      setActionError(null);
      setActionMessage('Kartica je uspješno zadužena.');
      setJustClaimed(true);
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

  const result = query.data as (MobileSimCard & { fromOfflineCache?: boolean }) | undefined;
  const isFromOfflineCache = result?.fromOfflineCache === true;
  const isAssignedToMe =
    result?.status === 'ASSIGNED' && result.assignedTo?.id === currentUserId;
  const isAssignedToAnother =
    result?.status === 'ASSIGNED' &&
    Boolean(result.assignedTo?.id) &&
    result.assignedTo?.id !== currentUserId;
  const canClaim = result?.status === 'AVAILABLE';

  const showClaimButton = Boolean(result && canClaim && !justClaimed);
  const showAssignedToMeInfo = Boolean(result && isAssignedToMe && !justClaimed);
  const showCreateRecordCta = Boolean(result && (isAssignedToMe || justClaimed));

  const statusLabel = useMemo(() => {
    if (!result) return null;
    if (result.status === 'AVAILABLE') return { text: 'Dostupna', tone: 'success' as const };
    if (result.status === 'ASSIGNED') return { text: 'Zadužena', tone: 'warn' as const };
    return { text: result.status, tone: 'neutral' as const };
  }, [result]);

  const StatusBadge = useMemo(() => {
    if (!statusLabel) return null;
    const bg =
      statusLabel.tone === 'success'
        ? '#dcfce7'
        : statusLabel.tone === 'warn'
          ? '#fef3c7'
          : '#f1f5f9';
    const fg =
      statusLabel.tone === 'success'
        ? '#166534'
        : statusLabel.tone === 'warn'
          ? '#92400e'
          : '#475569';
    return (
      <View
        style={{
          alignSelf: 'flex-start',
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 999,
          backgroundColor: bg,
        }}
      >
        <Text style={{ fontSize: 12, fontWeight: '600', color: fg }}>{statusLabel.text}</Text>
      </View>
    );
  }, [statusLabel]);

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
          <Text style={{ color: '#dc2626' }}>
            Backend nije dostupan sa mobilnog uređaja i nema lokalno sačuvanih podataka za ovu
            karticu.
          </Text>
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
          borderColor: colors.border,
          borderRadius: 12,
          padding: 12,
          gap: 6,
          backgroundColor: colors.surface,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontWeight: '700', fontSize: 16, color: colors.text }}>SIM info</Text>
          {StatusBadge}
        </View>
        <Text>ICCID: {result.iccid}</Text>
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
        <Text>Isporuka: {result.shipment?.name ?? '-'}</Text>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: '700' }}>Rezultat skena</Text>
      <Text style={{ color: colors.textMuted }}>ICCID: {iccid || '-'}</Text>

      {isFromOfflineCache && (
        <View
          style={{
            backgroundColor: '#fef3c7',
            borderColor: '#f59e0b',
            borderWidth: 1,
            borderRadius: 8,
            padding: 10,
          }}
        >
          <Text style={{ color: '#92400e', fontSize: 13 }}>
            Prikazani su podaci sačuvani lokalno za rad u offline režimu. Neki statusi kartice
            mogu biti zastarjeli.
          </Text>
        </View>
      )}

      {result && !isFromOfflineCache && (
        <View
          style={{
            backgroundColor: '#ecfdf3',
            borderColor: '#4ade80',
            borderWidth: 1,
            borderRadius: 8,
            padding: 10,
          }}
        >
          <Text style={{ color: '#166534', fontSize: 13 }}>
            Podaci o kartici su uspješno učitani i sačuvani za kasniji rad u offline režimu.
          </Text>
        </View>
      )}

      {renderBody()}

      {showClaimButton ? (
        <Pressable
          disabled={claimMutation.isPending}
          onPress={() => result && void claimMutation.mutate(result.id)}
          style={({ pressed }) => ({
            backgroundColor: pressed ? colors.primaryPressed : colors.primary,
            padding: 12,
            borderRadius: 10,
            alignItems: 'center',
            opacity: claimMutation.isPending ? 0.7 : 1,
          })}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>
            {claimMutation.isPending ? 'Zaduživanje...' : 'Zaduži karticu'}
          </Text>
        </Pressable>
      ) : null}

      {showAssignedToMeInfo ? (
        <Text style={{ color: '#15803d', fontWeight: '600' }}>
          Kartica je već zadužena kod tebe.
        </Text>
      ) : null}

      {showCreateRecordCta ? (
        <Pressable
          onPress={() =>
            result && router.push({ pathname: '/create-record', params: { simCardId: result.id } })
          }
          style={({ pressed }) => ({
            backgroundColor: pressed ? colors.primaryPressed : colors.primary,
            padding: 12,
            borderRadius: 10,
            alignItems: 'center',
          })}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>Kreiraj zapisnik ugradnje</Text>
        </Pressable>
      ) : null}
      {isAssignedToAnother ? (
        <Text style={{ color: '#b45309' }}>Kartica je već zadužena kod drugog operatora.</Text>
      ) : null}
      {result && !canClaim && !isAssignedToMe && !isAssignedToAnother ? (
        <Text style={{ color: colors.textMuted }}>
          Kartica nije u statusu `AVAILABLE` i ne može se zadužiti.
        </Text>
      ) : null}
      {actionMessage ? <Text style={{ color: '#15803d' }}>{actionMessage}</Text> : null}
      {actionError ? <Text style={{ color: '#dc2626' }}>{actionError}</Text> : null}

      <Pressable
        onPress={() => void query.refetch()}
        style={({ pressed }) => ({
          backgroundColor: pressed ? colors.primaryPressed : colors.primary,
          padding: 12,
          borderRadius: 10,
          alignItems: 'center',
        })}
      >
        <Text style={{ color: '#fff', fontWeight: '600' }}>Osvježi</Text>
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
        <Text style={{ color: '#fff', fontWeight: '600' }}>Novi scan</Text>
      </Pressable>
    </View>
  );
}
