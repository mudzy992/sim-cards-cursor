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

const statusLabels: Record<string, string> = {
  DRAFT: 'Nacrt',
  SENT: 'Poslano',
  SEND_FAILED: 'Greška pri slanju',
  SEP_ACTIVATED: 'SEP aktiviran',
  LEGACY_COMPLETED: 'Završeno (legacy)',
};

export default function RecordsScreen() {
  const router = useRouter();
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

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 8 }}>
      <Text style={{ fontSize: 20, fontWeight: '700' }}>Moji zapisnici</Text>
      <Text style={{ color: '#64748b' }}>
        Pregled zapisnika ugradnje koje ste kreirali.
      </Text>

      {error ? (
        <View style={{ gap: 8 }}>
          <Text style={{ color: '#dc2626' }}>{error}</Text>
          <Pressable
            onPress={() => void load(true)}
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
              borderColor: '#e2e8f0',
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
              <Text style={{ color: '#0f766e', fontWeight: '600' }}>Detalji</Text>
            </View>
            <Text style={{ color: '#64748b', fontSize: 14 }}>
              Brojilo: {item.meter?.serialNumber ?? '–'} • {item.meter?.meterTypeDefinition?.name ?? '–'}
            </Text>
            <Text style={{ color: '#64748b', fontSize: 14 }}>
              SIM: {item.meter?.simCard?.iccid ?? '–'}
            </Text>
            <View style={{ marginTop: 6 }}>
              <View
                style={{
                  backgroundColor: '#f1f5f9',
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
