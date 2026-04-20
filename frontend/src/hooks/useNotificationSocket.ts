import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import { getApiBaseUrls } from '@/api/axios.instance';
import { notification as antdNotification } from 'antd'
import type { Notification } from '@/api/notifications.api'

const getSocketUrls = (): string[] => {
  const baseUrls = getApiBaseUrls();
  return baseUrls
    .map((base) => base.replace(/\/api\/?$/, ''))
    .filter(Boolean);
};

export function useNotificationSocket() {
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.tokens?.accessToken);
  const isLoggedIn = !!token;

  useEffect(() => {
    if (!isLoggedIn || !token) return;

    const socketUrls = getSocketUrls();
    let socketIndex = 0;
    let socket = io(`${socketUrls[socketIndex]}/notifications`, {
      path: '/api/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    const onNotification = (payload?: Notification) => {
      void queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
      if (payload?.title && payload?.message) {
        antdNotification.open({
          message: payload.title,
          description: payload.message,
          placement: 'topRight',
          duration: 4,
        })
      }
    };

    socket.on('notification', onNotification);
    socket.on('connect_error', (err) => {
      const nextIndex = socketIndex + 1;
      if (nextIndex >= socketUrls.length) {
        console.warn('[Notifications] WebSocket connect error:', err.message);
        return;
      }

      socketIndex = nextIndex;
      socket.disconnect();
      socket = io(`${socketUrls[socketIndex]}/notifications`, {
        path: '/api/socket.io',
        auth: { token },
        transports: ['websocket', 'polling'],
      });
      socket.on('notification', onNotification);
    });

    return () => {
      socket.off('notification', onNotification);
      socket.disconnect();
    };
  }, [isLoggedIn, token, queryClient]);
}
