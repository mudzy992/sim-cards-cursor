import { axiosInstance } from './axios.instance';
import type { ApiEnvelope } from '@/types/common.types';
import type { PaginatedResult } from '@/types/common.types';

export interface ActivityLogItem {
  id: string;
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: unknown;
  ipAddress?: string;
  createdAt: string;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  };
}

export interface ActivityLogParams {
  page?: number;
  limit?: number;
  action?: string;
  entity?: string;
  userId?: string;
  from?: string;
  to?: string;
}

export const activityLogApi = {
  list: async (
    params?: ActivityLogParams,
  ): Promise<PaginatedResult<ActivityLogItem>> => {
    const response = await axiosInstance.get<
      ApiEnvelope<PaginatedResult<ActivityLogItem>>
    >('/activity-log', { params });
    return response.data.data;
  },

  listForInstallationRecord: async (
    id: string,
    params?: { page?: number; limit?: number },
  ): Promise<PaginatedResult<ActivityLogItem>> => {
    const response = await axiosInstance.get<
      ApiEnvelope<PaginatedResult<ActivityLogItem>>
    >(`/installation-records/${id}/timeline`, {
      params,
    });
    return response.data.data;
  },
};
