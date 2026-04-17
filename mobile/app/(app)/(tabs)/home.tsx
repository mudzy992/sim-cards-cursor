import axios from 'axios'
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/auth.store';
import { simCardsApi } from '@/api/sim-cards.api'
import { installationRecordsApi } from '@/api/installation-records.api'
import { notificationsApi } from '@/api/notifications.api';
import { useMiniTour } from '@/hooks/useMiniTour';
import { useConnectivity } from '@/hooks/useConnectivity'
import { offlineCache } from '@/offline/offline-cache'
import { listOutbox } from '@/offline/outbox'
import { syncMeterTypesOfflineCache } from '@/offline/meter-types-sync'
import { colors } from '@/theme/colors';

function StatCard({
  title,
  value,
  icon,
  hint,
}: {
  title: string;
  value: number | string;
  icon: keyof typeof Ionicons.glyphMap;
  hint?: string;
}) {
  return (
    <View
      style={{
        backgroundColor: '#f8fafc',
        padding: 16,
        borderRadius: 12,
        flex: 1,
        minWidth: '45%',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Ionicons name={icon} size={20} color={colors.primary} />
        <Text style={{ fontSize: 12, color: colors.textMuted }}>{title}</Text>
      </View>
      <Text style={{ fontSize: 24, fontWeight: '700', color: '#0f172a' }}>{value}</Text>
      {hint ? (
        <Text style={{ marginTop: 4, fontSize: 12, color: colors.textMuted }}>{hint}</Text>
      ) : null}
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const miniTour = useMiniTour();
  const { isOnline } = useConnectivity()

  const { data: operatorStats, isLoading } = useQuery({
    queryKey: ['operator-offline-stats', user?.id, isOnline],
    enabled: Boolean(user),
    queryFn: async () => {
      if (!user) {
        return {
          offlineSimCount: 0,
          offlineMeterTypeCount: 0,
          serverMeterTypeCount: null as number | null,
          installedSimCount: 0,
          installedMeterCount: 0,
          isStale: true,
          showMeterTypesSync: false,
        }
      }

      const offlineSims = await simCardsApi.listOfflineInventory()
      const cachedTypes = (await offlineCache.meterTypeDefinitions.get(user))?.data ?? []
      const offlineMeterTypeCount = cachedTypes.length

      let installedTotal = 0
      let isStale = true
      let serverMeterTypeCount: number | null = null
      if (isOnline) {
        try {
          const resp = await installationRecordsApi.listMy({ page: 1, limit: 1 })
          installedTotal = resp.total ?? (resp.items?.length ?? 0)
          const serverTypes = await (await import('@/api/meter-type-definitions.api')).meterTypeDefinitionsApi.list()
          serverMeterTypeCount = serverTypes.length
          isStale = false
        } catch (e) {
          if (!(axios.isAxiosError(e) && !e.response)) throw e
        }
      }

      const showMeterTypesSync =
        isOnline &&
        serverMeterTypeCount != null &&
        offlineMeterTypeCount !== serverMeterTypeCount

      return {
        offlineSimCount: offlineSims.length,
        offlineMeterTypeCount,
        serverMeterTypeCount,
        installedSimCount: installedTotal,
        installedMeterCount: installedTotal,
        isStale,
        showMeterTypesSync,
      }
    },
  });

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: () => notificationsApi.getUnreadCount(),
  });

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text style={{ fontSize: 22, fontWeight: '700', color: '#0f172a' }}>
            Dobrodošao/la, {user?.firstName ?? 'Korisnik'}
          </Text>
          <Text style={{ fontSize: 14, color: colors.textMuted, marginTop: 4 }}>
            Pregled statistika i aktivnosti
          </Text>
        </View>
        <Pressable
          onPress={() => router.push('/notifications')}
          style={{
            padding: 10,
            backgroundColor: '#f1f5f9',
            borderRadius: 12,
            position: 'relative',
          }}
        >
          <Ionicons name="notifications-outline" size={24} color={colors.primary} />
          {unreadCount > 0 && (
            <View
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                backgroundColor: '#dc2626',
                borderRadius: 10,
                minWidth: 18,
                height: 18,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 4,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </Pressable>
      </View>

      {isLoading ? (
        <View style={{ padding: 32, alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : operatorStats ? (
        <View style={{ gap: 12 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#334155' }}>
            Statistike
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            <StatCard
              title="Offline SIM"
              value={operatorStats.offlineSimCount}
              icon="albums-outline"
            />
            <StatCard
              title="Tipovi brojila"
              value={operatorStats.offlineMeterTypeCount}
              icon="list-outline"
              hint={
                operatorStats.serverMeterTypeCount != null
                  ? `U bazi: ${operatorStats.serverMeterTypeCount}`
                  : 'U bazi: —'
              }
            />
            <StatCard
              title="Ugrađene SIM"
              value={operatorStats.installedSimCount}
              icon="hardware-chip-outline"
            />
            <StatCard
              title="Ugrađena brojila"
              value={operatorStats.installedMeterCount}
              icon="checkmark-circle-outline"
            />
          </View>
          {operatorStats.showMeterTypesSync ? (
            <Pressable
              onPress={() => {
                if (!user) return
                void (async () => {
                  await syncMeterTypesOfflineCache(user)
                })()
              }}
              style={({ pressed }) => ({
                marginTop: 4,
                backgroundColor: pressed ? colors.primaryPressed : colors.primary,
                paddingVertical: 12,
                borderRadius: 12,
                alignItems: 'center',
              })}
            >
              <Text style={{ color: '#fff', fontWeight: '800' }}>Sync tipova brojila</Text>
            </Pressable>
          ) : null}
          {operatorStats.isStale && (
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>
              Prikaz može biti zastario (offline ili backend nedostupan).
            </Text>
          )}
        </View>
      ) : null}

      {!miniTour.loading && miniTour.visible && (
        <View
          style={{
            marginTop: 8,
            padding: 14,
            borderRadius: 12,
            backgroundColor: '#eef2ff',
            borderWidth: 1,
            borderColor: '#c7d2fe',
            gap: 8,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#1e293b' }}>
            Kratki vodič kroz aplikaciju
          </Text>
          <Text style={{ fontSize: 12, color: '#4b5563' }}>
            • Tab „Skeniranje“ – skeniraj ili unesi ICCID za novi zapisnik.{'\n'}
            • Tab „Zapisnici“ – pregledi tvojih zapisnika i statusa.{'\n'}
            • Tab „Demontaža“ – zadaci za skidanje SIM kartica.{'\n'}
            • Tab „Profil“ – osnovni podaci i odjava.
          </Text>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-end',
              gap: 12,
              marginTop: 4,
            }}
          >
            <Pressable onPress={miniTour.dismiss}>
              <Text style={{ fontSize: 12, color: '#6b7280' }}>Kasnije</Text>
            </Pressable>
            <Pressable onPress={miniTour.complete}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.link }}>
                Razumijem
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </ScrollView>
  );
}
