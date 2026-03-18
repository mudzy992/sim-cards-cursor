import { axiosInstance } from './axios.instance';

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
  list: async (params?: { limit?: number }): Promise<Notification[]> => {
    const response = await axiosInstance.get<{ data: Notification[] }>(
      '/notifications',
      { params },
    );
    return response.data.data;
  },

  getUnreadCount: async (): Promise<number> => {
    const response = await axiosInstance.get<{ data: number }>(
      '/notifications/unread-count',
    );
    return response.data.data;
  },

  markAsRead: async (id: string): Promise<Notification> => {
    const response = await axiosInstance.post<{ data: Notification }>(
      `/notifications/${id}/read`,
    );
    return response.data.data;
  },

  markAllAsRead: async (): Promise<{ count: number }> => {
    const response = await axiosInstance.post<{ data: { count: number } }>(
      '/notifications/read-all',
    );
    return response.data.data;
  },
};
