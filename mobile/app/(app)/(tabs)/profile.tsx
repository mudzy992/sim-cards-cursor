import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { Ionicons } from '@expo/vector-icons'
import { colors } from '@/theme/colors'

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <View style={{ flex: 1, padding: 16, gap: 10 }}>
      <Text style={{ fontSize: 20, fontWeight: '700' }}>Profil</Text>
      <Text>{user?.firstName} {user?.lastName}</Text>
      <Text style={{ color: '#64748b' }}>{user?.email}</Text>
      <Text style={{ color: '#64748b' }}>Role: {user?.role}</Text>

      <View style={{ marginTop: 14, gap: 10 }}>
        <Pressable
          onPress={() => router.push('/(app)/offline-inventory')}
          style={({ pressed }) => ({
            backgroundColor: pressed ? '#e2e8f0' : '#f1f5f9',
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          })}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons name="albums-outline" size={20} color={colors.primary} />
            <Text style={{ fontWeight: '700' }}>Offline inventar</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#64748b" />
        </Pressable>

        <Pressable
          onPress={() => router.push('/(app)/outbox')}
          style={({ pressed }) => ({
            backgroundColor: pressed ? '#e2e8f0' : '#f1f5f9',
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          })}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons name="cloud-upload-outline" size={20} color={colors.primary} />
            <Text style={{ fontWeight: '700' }}>Neposlato</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#64748b" />
        </Pressable>
      </View>

      <Pressable
        onPress={() => void handleLogout()}
        style={{
          marginTop: 14,
          backgroundColor: '#dc2626',
          padding: 12,
          borderRadius: 10,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#fff' }}>Odjava</Text>
      </Pressable>
    </View>
  );
}
