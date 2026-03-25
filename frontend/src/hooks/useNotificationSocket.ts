import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import { getApiBaseUrls } from '@/api/axios.instance';

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

    const onNotification = () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
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
