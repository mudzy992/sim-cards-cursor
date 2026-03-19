import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';
import { pushTokensApi } from '@/api/push-tokens.api';
import { settingsApi } from '@/api/settings.api';

function resolveProjectId(): string | undefined {
  const fromEnv = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  const fromExpoConfig = (Constants?.expoConfig?.extra as any)?.eas?.projectId;
  const fromEasConfig = (Constants as any)?.easConfig?.projectId;
  const fromManifest2 = (Constants as any)?.manifest2?.extra?.eas?.projectId;
  return fromEnv || fromEasConfig || fromExpoConfig || fromManifest2;
}

function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

async function configureNotificationHandlerAsync(
  Notifications: typeof import('expo-notifications'),
) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function configureChannels(
  Notifications: typeof import('expo-notifications'),
) {
  if (Platform.OS !== 'android') return;

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

async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (isExpoGo()) {
    console.warn(
      '[Push] Expo Go: remote push nije podržan (SDK 53+). Preskačem registraciju.',
    );
    return null;
  }

  const Notifications = await import('expo-notifications');
  await configureNotificationHandlerAsync(Notifications);
  await configureChannels(Notifications);

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.warn('[Push] Permission not granted:', finalStatus);
    return null;
  }

  if (!Device.isDevice) {
    console.warn('[Push] Not registering token on simulator/emulator.');
    return null;
  }

  const projectId = resolveProjectId();
  if (!projectId) {
    console.error('[Push] Missing EAS projectId for push token generation.');
    return null;
  }

  try {
    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenResponse?.data;
    if (!token) return null;
    console.log('[Push] Expo push token acquired:', token);
    return token;
  } catch (e: any) {
    console.error('[Push] getExpoPushTokenAsync failed:', e?.message ?? e);
    return null;
  }
}

export function usePushNotifications() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) {
      return;
    }

    let isMounted = true;
    let responseListener: { remove: () => void } | null = null;

    (async () => {
      const mobilePushEnabled = await settingsApi.getMobilePushEnabled();
      if (!mobilePushEnabled) {
        console.log(
          '[Push] Globalni flag mobile.push.enabled = false, preskačem registraciju push notifikacija.',
        );
        return;
      }

      if (isExpoGo()) {
        console.warn(
          '[Push] Expo Go: remote push nije podržan (SDK 53+). Preskačem registraciju.',
        );
        return;
      }

      const Notifications = await import('expo-notifications');
      responseListener =
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

      const token = await registerForPushNotificationsAsync();
      if (!isMounted || !token) return;

      try {
        await pushTokensApi.register({
          token,
          platform: Platform.OS,
          deviceId: user.id,
        });
      } catch (e) {
        console.warn('Push token register failed', e);
      }
    })();

    return () => {
      isMounted = false;
      responseListener?.remove();
    };
  }, [router, user]);
}

