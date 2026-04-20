import { axiosInstance } from './axios.instance';
import type { ApiEnvelope } from '@/types/common.types';

export type DemountTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type DemountTaskType = 'DEMOUNT_METER' | 'DEMOUNT_SIM';

export type DemountCompletionResolution =
  | 'FULL_DEMOUNT'
  | 'REPLACE_SIM'
  | 'REMOVE_SIM_ONLY';

export type RemovedSimDisposition = 'MARK_DEFECTIVE' | 'RETURN_TO_STOCK'

export type MeterDemountCategory =
  | 'METER_FAULTY'
  | 'TEMPORARY_REMOVAL'
  | 'MAINTENANCE'
  | 'OTHER'

export type DemountTaskItem = {
  id: string;
  meterId: string;
  assignedToId: string;
  createdById: string;
  status: DemountTaskStatus;
  taskType?: DemountTaskType;
  requestedResolution?: DemountCompletionResolution | null
  requestedReason?: string | null
  requestedRemovedSimDisposition?: RemovedSimDisposition | null
  requestedMeterDemountCategory?: MeterDemountCategory | null
  completionResolution?: DemountCompletionResolution | null;
  completionReason?: string | null;
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
  getMy: async (params?: {
    status?: DemountTaskStatus;
  }): Promise<DemountTaskItem[]> => {
    const response = await axiosInstance.get<ApiEnvelope<DemountTaskItem[]>>(
      '/demount-tasks/my',
      { params },
    );
    return response.data.data;
  },

  create: async (payload: {
    meterId: string;
    assignedToId: string;
    notes?: string;
    taskType?: DemountTaskType;
    requestedResolution: DemountCompletionResolution
    requestedReason: string
    requestedRemovedSimDisposition: RemovedSimDisposition
    requestedMeterDemountCategory?: MeterDemountCategory
  }): Promise<DemountTaskItem> => {
    const response = await axiosInstance.post<ApiEnvelope<DemountTaskItem>>(
      '/demount-tasks',
      payload,
    );
    return response.data.data;
  },

  updateStatus: async (
    id: string,
    status: DemountTaskStatus,
  ): Promise<DemountTaskItem> => {
    const response = await axiosInstance.patch<ApiEnvelope<DemountTaskItem>>(
      `/demount-tasks/${id}/status`,
      { status },
    );
    return response.data.data;
  },
};
