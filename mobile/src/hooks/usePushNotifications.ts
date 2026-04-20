import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';
import { pushTokensApi } from '@/api/push-tokens.api';
import { settingsApi } from '@/api/settings.api';
import { colors } from '@/theme/colors';
import { useGlobalBlockingStore } from '@/store/global-blocking.store'
import { normalizeDeepLink } from '@/utils/deeplink'
import { useQueryClient } from '@tanstack/react-query'

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
    lightColor: colors.primary,
  });
  await Notifications.setNotificationChannelAsync('records', {
    name: 'Zapisnici',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200, 200, 200],
    lightColor: colors.primary,
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

  const existingPermission = await Notifications.getPermissionsAsync();
  const existingStatus =
    typeof existingPermission === 'string'
      ? existingPermission
      : (existingPermission as { status?: string })?.status;
  let finalStatus = existingStatus ?? 'undetermined';
  if (existingStatus !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    const requestedStatus =
      typeof requested === 'string' ? requested : (requested as { status?: string })?.status;
    finalStatus = requestedStatus ?? finalStatus;
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
  const queryClient = useQueryClient()
  const { isBlocked, queueDeepLink } = useGlobalBlockingStore((s) => ({
    isBlocked: s.isBlocked,
    queueDeepLink: s.queueDeepLink,
  }))

  useEffect(() => {
    if (!user) {
      return;
    }

    let isMounted = true;
    let responseListener: { remove: () => void } | null = null;
    let receivedListener: { remove: () => void } | null = null;

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
          const normalized = normalizeDeepLink(data?.deepLink) ?? '/notifications'
          if (isBlocked) {
            queueDeepLink(normalized)
            return
          }
          router.push(normalized as never);
        });

      receivedListener = Notifications.addNotificationReceivedListener(() => {
        void queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] })
        void queryClient.invalidateQueries({ queryKey: ['notifications-list'] })
      })

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
      receivedListener?.remove();
    };
  }, [isBlocked, queryClient, queueDeepLink, router, user]);
}
