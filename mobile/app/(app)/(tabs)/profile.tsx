import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useAuth } from '@/hooks/useAuth';

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
