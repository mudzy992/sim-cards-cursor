import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export default function PrivateLayout() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  usePushNotifications();

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="record-details" options={{ title: 'Detalji zapisnika' }} />
      <Stack.Screen name="scan-result" options={{ title: 'Rezultat skena' }} />
      <Stack.Screen name="create-record" options={{ title: 'Novi zapisnik' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifikacije' }} />
    </Stack>
  );
}
