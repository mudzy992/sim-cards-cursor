import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/auth.store';
import { dashboardApi } from '@/api/dashboard.api';
import { notificationsApi } from '@/api/notifications.api';
import { useMiniTour } from '@/hooks/useMiniTour';

const statusLabels: Record<string, string> = {
  DRAFT: 'Nacrt',
  PENDING: 'Čeka odobrenje',
  SUBMIT_FAILED: 'Greška pri slanju',
  REJECTED: 'Odbijen',
  WAITING_SEP_ACTIVATION: 'Čeka aktivaciju SEP',
  ACTIVATED_IN_SEP: 'Aktivirano u SEP',
  SENT: 'Poslano',
};

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
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
        <Ionicons name={icon} size={20} color="#0f766e" />
        <Text style={{ fontSize: 12, color: '#64748b' }}>{title}</Text>
      </View>
      <Text style={{ fontSize: 24, fontWeight: '700', color: '#0f172a' }}>{value}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const miniTour = useMiniTour();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardApi.getStats(),
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
            Dobrodošao, {user?.firstName ?? 'Korisnik'}
          </Text>
          <Text style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>
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
          <Ionicons name="notifications-outline" size={24} color="#0f766e" />
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
          <ActivityIndicator size="large" color="#0f766e" />
        </View>
      ) : stats ? (
        <View style={{ gap: 12 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#334155' }}>
            Statistike
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            <StatCard
              title="Zapisnici"
              value={stats.installationRecords?.total ?? 0}
              icon="document-text"
            />
            <StatCard
              title="SIM kartice"
              value={stats.simCards?.total ?? 0}
              icon="phone-portrait-outline"
            />
            <StatCard
              title="Brojila"
              value={stats.meters ?? 0}
              icon="flash"
            />
            <StatCard
              title="Instalirano"
              value={stats.simCards?.installed ?? 0}
              icon="checkmark-circle"
            />
          </View>
          <View style={{ marginTop: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#64748b', marginBottom: 8 }}>
              Moja analitika (osnovno)
            </Text>
            <Text style={{ fontSize: 12, color: '#64748b' }}>
              Zapisnici u zadnjih 30 dana: {stats.installationRecords?.total ?? 0}
            </Text>
          </View>
          {stats.installationRecords?.byStatus &&
            Object.keys(stats.installationRecords.byStatus).length > 0 && (
              <View style={{ marginTop: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#64748b', marginBottom: 8 }}>
                  Zapisnici po statusu
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {Object.entries(stats.installationRecords.byStatus).map(([status, count]) => {
                    const label = statusLabels[status] ?? status;
                    return (
                      <View
                        key={status}
                        style={{
                          backgroundColor: '#e2e8f0',
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 8,
                        }}
                      >
                        <Text style={{ fontSize: 12, color: '#475569' }}>
                          {label}: {count}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
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
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#4f46e5' }}>
                Razumijem
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </ScrollView>
  );
}
