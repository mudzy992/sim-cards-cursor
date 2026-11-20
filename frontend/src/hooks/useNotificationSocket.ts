import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import { getApiBaseUrls } from '@/api/axios.instance';
import { notification as antdNotification } from 'antd';
import type { Notification } from '@/api/notifications.api';

const getSocketOrigins = (): string[] => {
  const baseUrls = getApiBaseUrls();
  const origins = baseUrls
    .map((base) => {
      try {
        const parsed = new URL(base, window.location.origin);
        return parsed.origin;
      } catch {
        return '';
      }
    })
    .filter(Boolean);
  return origins.length > 0 ? [...new Set(origins)] : [window.location.origin];
};

export function useNotificationSocket() {
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.tokens?.accessToken);
  const isLoggedIn = !!token;

  useEffect(() => {
    if (!isLoggedIn || !token) return;

    const socketOrigins = getSocketOrigins();
    let socketIndex = 0;

    const connectTo = (origin: string) =>
      io(`${origin}/notifications`, {
        path: '/api/socket.io',
        auth: { token },
        transports: ['websocket', 'polling'],
      });

    let socket = connectTo(socketOrigins[socketIndex]);

    const onNotification = (payload?: Notification) => {
      void queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
      if (payload?.title && payload?.message) {
        antdNotification.open({
          message: payload.title,
          description: payload.message,
          placement: 'topRight',
          duration: 4,
        });
      }
    };

    const onConnectError = (err: Error) => {
      const nextIndex = socketIndex + 1;
      if (nextIndex >= socketOrigins.length) {
        console.warn('[Notifications] WebSocket connect error:', err.message);
        return;
      }

      socketIndex = nextIndex;
      socket.off('notification', onNotification);
      socket.off('connect_error', onConnectError);
      socket.disconnect();
      socket = connectTo(socketOrigins[socketIndex]);
      socket.on('notification', onNotification);
      socket.on('connect_error', onConnectError);
    };

    socket.on('notification', onNotification);
    socket.on('connect_error', onConnectError);

    return () => {
      socket.off('notification', onNotification);
      socket.off('connect_error', onConnectError);
      socket.disconnect();
    };
  }, [isLoggedIn, token, queryClient]);
}
