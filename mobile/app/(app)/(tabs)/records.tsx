import axios from 'axios';
import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { installationRecordsApi, syncOfflineInstallationRecords } from '@/api/installation-records.api';
import type { InstallationRecordItem } from '@/api/installation-records.api';
import { useConnectivity } from '@/hooks/useConnectivity'
import { OfflineRequiredNotice } from '@/components/common/OfflineRequiredNotice'
import { colors } from '@/theme/colors';

const statusLabels: Record<string, string> = {
  DRAFT: 'Nacrt',
  SENT: 'Poslano',
  SEND_FAILED: 'Greška pri slanju',
  SEP_ACTIVATED: 'SEP aktiviran',
  LEGACY_COMPLETED: 'Završeno (legacy)',
};

export default function RecordsScreen() {
  const router = useRouter();
  const { isOnline } = useConnectivity()
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<InstallationRecordItem[]>([]);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);
    try {
      // prvo pokušaj da pošalješ offline kreirane zapisnike
      await syncOfflineInstallationRecords();

      const data = await installationRecordsApi.listMy({ page: 1, limit: 50 });
      setItems(data.items ?? []);
    } catch (err) {
      if (axios.isAxiosError(err) && !err.response) {
        setError('Backend nije dostupan sa mobilnog uređaja.');
      } else {
        setError('Ne mogu učitati zapisnike.');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(false);
    }, [load]),
  );

  if (!isOnline) {
    return (
      <OfflineRequiredNotice
        message="Pregled zapisnika zahtijeva internet vezu. Offline možete raditi kroz skeniranje i wizard-e; sve se šalje kasnije."
        onRetry={() => void load(true)}
      />
    )
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 8 }}>
      <Text style={{ fontSize: 20, fontWeight: '700' }}>Moji zapisnici</Text>
      <Text style={{ color: colors.textMuted }}>
        Pregled zapisnika ugradnje koje ste kreirali.
      </Text>

      {error ? (
        <View style={{ gap: 8 }}>
          <Text style={{ color: '#dc2626' }}>{error}</Text>
          <Pressable
            onPress={() => void load(true)}
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
      ) : null}

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => void load(true)} />
        }
        ListEmptyComponent={
          <Text style={{ color: '#64748b', marginTop: 24, textAlign: 'center' }}>
            Nema zapisnika.
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/(app)/record-details',
                params: { id: item.id },
              })
            }
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 10,
              padding: 12,
              marginBottom: 8,
            }}
          >
            <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text style={{ fontWeight: '700' }}>{item.recordNumber}</Text>
              <Text style={{ color: colors.link, fontWeight: '600' }}>Detalji</Text>
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 14 }}>
              Brojilo: {item.meter?.serialNumber ?? '–'} • {item.meter?.meterTypeDefinition?.name ?? '–'}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 14 }}>
              SIM: {item.meter?.simCard?.iccid ?? '–'}
            </Text>
            <View style={{ marginTop: 6 }}>
              <View
                style={{
                  backgroundColor: colors.surfaceMuted,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 6,
                }}
              >
                <Text style={{ fontSize: 12, color: '#475569' }}>
                  {statusLabels[item.status] ?? item.status}
                </Text>
              </View>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}
