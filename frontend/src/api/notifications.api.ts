import { axiosInstance } from './axios.instance';
import type { ApiEnvelope } from '@/types/common.types';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  link?: string;
  createdAt: string;
}

export const notificationsApi = {
  list: async (params?: {
    unreadOnly?: boolean;
    limit?: number;
  }): Promise<Notification[]> => {
    const response = await axiosInstance.get<ApiEnvelope<Notification[]>>(
      '/notifications',
      { params },
    );
    return response.data.data;
  },

  getUnreadCount: async (): Promise<number> => {
    const response = await axiosInstance.get<ApiEnvelope<number>>(
      '/notifications/unread-count',
    );
    return response.data.data as number;
  },

  markAsRead: async (id: string): Promise<Notification> => {
    const response = await axiosInstance.post<ApiEnvelope<Notification>>(
      `/notifications/${id}/read`,
    );
    return response.data.data;
  },

  markAllAsRead: async (): Promise<{ count: number }> => {
    const response = await axiosInstance.post<
      ApiEnvelope<{ count: number }>
    >('/notifications/read-all');
    return response.data.data;
  },
};
