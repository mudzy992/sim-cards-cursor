import { axiosInstance } from './axios.instance';
import type { ApiEnvelope } from '@/types/common.types';

export interface DashboardStats {
  installationRecords: {
    total: number;
    byStatus: Record<string, number>;
  };
  simCards: {
    total: number;
    available: number;
    assigned: number;
    installed: number;
  };
  meters: number;
}

export interface RecentRecord {
  id: string;
  recordNumber: string;
  status: string;
  createdAt: string;
  meter?: { serialNumber: string };
  installedBy?: { firstName: string; lastName: string };
}

export const dashboardApi = {
  getStats: async (): Promise<DashboardStats> => {
    const response = await axiosInstance.get<ApiEnvelope<DashboardStats>>(
      '/dashboard/stats',
    );
    return response.data.data;
  },

  getRecentRecords: async (
    limit?: number,
  ): Promise<RecentRecord[]> => {
    const response = await axiosInstance.get<
      ApiEnvelope<RecentRecord[]>
    >('/dashboard/recent-records', { params: { limit } });
    return response.data.data;
  },

  getRecordsChart: async (
    days?: number,
  ): Promise<{ date: string; count: number }[]> => {
    const response = await axiosInstance.get<
      ApiEnvelope<{ date: string; count: number }[]>
    >('/dashboard/records-chart', { params: { days } });
    return response.data.data;
  },
};
