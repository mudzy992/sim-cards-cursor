import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';

const getSocketUrl = () => {
  const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api';
  // API basa je npr. http://localhost:3000/api -> socket server je http://localhost:3000
  const url = base.replace(/\/api\/?$/, '') || 'http://localhost:3000';
  return url;
};

export function useNotificationSocket() {
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.tokens?.accessToken);
  const isLoggedIn = !!token;

  useEffect(() => {
    if (!isLoggedIn || !token) return;

    const url = getSocketUrl();
    const socket = io(`${url}/notifications`, {
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
      console.warn('[Notifications] WebSocket connect error:', err.message);
    });

    return () => {
      socket.off('notification', onNotification);
      socket.disconnect();
    };
  }, [isLoggedIn, token, queryClient]);
}
