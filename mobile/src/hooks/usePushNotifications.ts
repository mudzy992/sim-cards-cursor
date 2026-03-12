import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';
import { pushTokensApi } from '@/api/push-tokens.api';

async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Opće obavijesti',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0f766e',
    });
    await Notifications.setNotificationChannelAsync('records', {
      name: 'Zapisnici',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 200, 200, 200],
      lightColor: '#0f766e',
    });
    await Notifications.setNotificationChannelAsync('system', {
      name: 'Sistemske poruke',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 300, 300, 300],
      lightColor: '#b91c1c',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    return null;
  }

  // Token retrieval only works on physical devices.
  if (!Device.isDevice) {
    return null;
  }

  const projectId =
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.eas?.projectId;

  const token = await Notifications.getExpoPushTokenAsync({
    projectId: projectId ?? undefined,
  });
  return token.data ?? null;
}

export function usePushNotifications() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) {
      return;
    }

    let isMounted = true;

    (async () => {
      const token = await registerForPushNotificationsAsync();
      if (!isMounted || !token) return;

      try {
        await pushTokensApi.register({
          token,
          platform: Platform.OS,
        });
      } catch (e) {
        console.warn('Push token register failed', e);
      }
    })();

    const responseListener =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as {
          deepLink?: string;
        };
        if (data?.deepLink) {
          router.push(data.deepLink as never);
        } else {
          router.push('/(app)/notifications' as never);
        }
      });

    return () => {
      isMounted = false;
      responseListener.remove();
    };
  }, [router, user]);
}

