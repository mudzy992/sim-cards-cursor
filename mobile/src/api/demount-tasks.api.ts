import { axiosInstance } from './axios.instance';

export type DemountTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type DemountTaskItem = {
  id: string;
  meterId: string;
  assignedToId: string;
  createdById: string;
  status: DemountTaskStatus;
  notes?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  meter?: {
    id: string;
    serialNumber: string;
    simCard?: { iccid: string; ipAddress: string } | null;
    meterTypeDefinition?: { name: string } | null;
  };
  assignedTo?: { firstName: string; lastName: string };
  createdBy?: { firstName: string; lastName: string };
};

export const demountTasksApi = {
  getMy: async (params?: { status?: DemountTaskStatus }): Promise<DemountTaskItem[]> => {
    const response = await axiosInstance.get<{ data: DemountTaskItem[] }>(
      '/demount-tasks/my',
      { params },
    );
    const data = response.data?.data ?? response.data;
    return Array.isArray(data) ? data : [];
  },

  updateStatus: async (
    id: string,
    status: DemountTaskStatus,
  ): Promise<DemountTaskItem> => {
    const response = await axiosInstance.patch<{ data: DemountTaskItem }>(
      `/demount-tasks/${id}/status`,
      { status },
    );
    return response.data.data;
  },
};
