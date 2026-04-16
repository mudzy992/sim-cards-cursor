import axios from 'axios';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { demountTasksApi, type DemountTaskItem, type DemountTaskStatus } from '@/api/demount-tasks.api';
import { colors } from '@/theme/colors';

const statusLabels: Record<DemountTaskStatus, string> = {
  PENDING: 'Čeka',
  IN_PROGRESS: 'U toku',
  COMPLETED: 'Završeno',
  CANCELLED: 'Otkazano',
};

const statusActions: Record<DemountTaskStatus, DemountTaskStatus[]> = {
  PENDING: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: ['PENDING'],
};

export default function DemountScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<DemountTaskItem[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);
    try {
      const data = await demountTasksApi.getMy();
      setItems(data);
    } catch (err) {
      if (axios.isAxiosError(err) && !err.response) {
        setError('Backend nije dostupan.');
      } else {
        setError('Nije moguće učitati zadatke demontaže.');
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

  const handleStatusChange = async (task: DemountTaskItem, newStatus: DemountTaskStatus) => {
    setUpdatingId(task.id);
    try {
      await demountTasksApi.updateStatus(task.id, newStatus);
      void load(true);
    } catch (err) {
      const msg =
        axios.isAxiosError(err) && typeof err.response?.data?.message === 'string'
          ? err.response.data.message
          : 'Ažuriranje statusa nije uspjelo.';
      Alert.alert('Greška', msg);
    } finally {
      setUpdatingId(null);
    }
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 8 }}>
      <Text style={{ fontSize: 20, fontWeight: '700' }}>Zadaci demontaže</Text>
      <Text style={{ color: colors.textMuted }}>
        Lista zadataka za demontažu SIM kartica s brojila.
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
            Nema zadataka demontaže.
          </Text>
        }
        renderItem={({ item }) => (
          <View
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 10,
              padding: 12,
              marginBottom: 8,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ fontWeight: '700', fontSize: 16 }}>
                {item.meter?.serialNumber ?? 'Brojilo'}
              </Text>
              <View
                style={{
                  backgroundColor:
                    item.status === 'COMPLETED'
                      ? '#dcfce7'
                      : item.status === 'CANCELLED'
                        ? '#fee2e2'
                        : '#fef3c7',
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 6,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color:
                      item.status === 'COMPLETED'
                        ? '#166534'
                        : item.status === 'CANCELLED'
                          ? '#991b1b'
                          : '#92400e',
                  }}
                >
                  {statusLabels[item.status]}
                </Text>
              </View>
            </View>
            {item.meter?.simCard && (
              <Text style={{ color: '#64748b', fontSize: 14 }}>
                SIM: {item.meter.simCard.iccid} • IP: {item.meter.simCard.ipAddress}
              </Text>
            )}
            {item.meter?.meterTypeDefinition && (
              <Text style={{ color: '#64748b', fontSize: 14 }}>
                Tip: {item.meter.meterTypeDefinition.name}
              </Text>
            )}
            {statusActions[item.status].length > 0 && (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                {statusActions[item.status].map((status) => (
                  <Pressable
                    key={status}
                    disabled={updatingId === item.id}
                    onPress={() => handleStatusChange(item, status)}
                    style={({ pressed }) => ({
                      backgroundColor: pressed ? colors.primaryPressed : colors.primary,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 8,
                      opacity: updatingId === item.id ? 0.7 : 1,
                    })}
                  >
                    {updatingId === item.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>
                        {status === 'IN_PROGRESS'
                          ? 'Započni'
                          : status === 'COMPLETED'
                            ? 'Završi'
                            : status === 'CANCELLED'
                              ? 'Otkaži'
                              : 'Vrati na čekanje'}
                      </Text>
                    )}
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}
      />
    </View>
  );
}
