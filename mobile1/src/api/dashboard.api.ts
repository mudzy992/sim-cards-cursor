import { axiosInstance } from './axios.instance';

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

export const dashboardApi = {
  getStats: async (): Promise<DashboardStats> => {
    const response = await axiosInstance.get<{ data: DashboardStats }>(
      '/dashboard/stats',
    );
    return response.data.data;
  },
};
