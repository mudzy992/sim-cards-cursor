import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { Ionicons } from '@expo/vector-icons'
import { colors } from '@/theme/colors'
import { ScreenHeader } from '@/components/common/ScreenHeader'
import { Screen } from '@/components/common/Screen'
import { Card } from '@/components/common/Card'

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Profil"
        subtitle={user ? `${user.firstName} ${user.lastName}` : '—'}
      />
      <Screen scroll contentStyle={{ paddingTop: 14, gap: 12 }}>
        <Card style={{ gap: 6 }}>
          <Text style={{ color: colors.text, fontWeight: '800' }}>
            {user?.firstName} {user?.lastName}
          </Text>
          <Text style={{ color: colors.textMuted }}>{user?.email ?? '—'}</Text>
          <Text style={{ color: colors.textMuted }}>Role: {user?.role ?? '—'}</Text>
        </Card>

        <View style={{ gap: 10 }}>
          <Pressable
            onPress={() => router.push('/(app)/offline-inventory')}
            style={({ pressed }) => ({
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Card style={{ padding: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      backgroundColor: colors.surfaceMuted,
                      borderWidth: 1,
                      borderColor: colors.border,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="albums-outline" size={18} color={colors.primary} />
                  </View>
                  <View style={{ gap: 2 }}>
                    <Text style={{ fontWeight: '800', color: colors.text }}>Offline inventar</Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>SIM kartice dostupne bez interneta</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </View>
            </Card>
          </Pressable>

          <Pressable
            onPress={() => router.push('/(app)/outbox')}
            style={({ pressed }) => ({
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Card style={{ padding: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      backgroundColor: colors.surfaceMuted,
                      borderWidth: 1,
                      borderColor: colors.border,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="cloud-upload-outline" size={18} color={colors.primary} />
                  </View>
                  <View style={{ gap: 2 }}>
                    <Text style={{ fontWeight: '800', color: colors.text }}>Neposlato</Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted }}>Stavke za slanje kada mreža dođe</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </View>
            </Card>
          </Pressable>
        </View>

        <Pressable
          onPress={() => void handleLogout()}
          style={({ pressed }) => ({
            backgroundColor: pressed ? '#b91c1c' : colors.danger,
            padding: 14,
            borderRadius: 12,
            alignItems: 'center',
          })}
        >
          <Text style={{ color: '#fff', fontWeight: '900' }}>Odjava</Text>
        </Pressable>
      </Screen>
    </View>
  );
}
