import { axiosInstance } from './axios.instance';
import axios from 'axios'
import { useAuthStore } from '@/store/auth.store'
import { offlineCache } from '@/offline/offline-cache'
import { enqueueOutboxItem } from '@/offline/outbox'

export type DemountTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type DemountTaskType = 'DEMOUNT_METER' | 'DEMOUNT_SIM';

export type DemountCompletionResolution =
  | 'FULL_DEMOUNT'
  | 'REPLACE_SIM'
  | 'REMOVE_SIM_ONLY';

export type DemountTaskItem = {
  id: string;
  meterId: string;
  assignedToId: string;
  createdById: string;
  status: DemountTaskStatus;
  taskType?: DemountTaskType;
  completionResolution?: DemountCompletionResolution | null;
  completionReason?: string | null;
  notes?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  meter?: {
    id: string;
    serialNumber: string;
    simCardState?: string;
    simCard?: { id: string; iccid: string; ipAddress: string } | null;
    meterTypeDefinition?: { name: string } | null;
  };
  assignedTo?: { firstName: string; lastName: string };
  createdBy?: { firstName: string; lastName: string };
};

export type CompleteDemountTaskPayload = {
  resolution: DemountCompletionResolution;
  reason: string;
  newSimCardId?: string;
};

export const demountTasksApi = {
  getMy: async (params?: { status?: DemountTaskStatus }): Promise<DemountTaskItem[]> => {
    const user = useAuthStore.getState().user
    try {
      const response = await axiosInstance.get<{ data: DemountTaskItem[] }>(
        '/demount-tasks/my',
        { params },
      )
      const data = response.data?.data ?? response.data
      const list = Array.isArray(data) ? data : []
      if (user && !params?.status) await offlineCache.demountTasksMy.set(user, list)
      return list
    } catch (error) {
      if (axios.isAxiosError(error) && !error.response && user && !params?.status) {
        return (await offlineCache.demountTasksMy.get(user))?.data ?? []
      }
      throw error
    }
  },

  updateStatus: async (
    id: string,
    status: DemountTaskStatus,
  ): Promise<DemountTaskItem> => {
    const user = useAuthStore.getState().user
    try {
      const response = await axiosInstance.patch<{ data: DemountTaskItem }>(
        `/demount-tasks/${id}/status`,
        { status },
      )
      return response.data.data
    } catch (error) {
      if (axios.isAxiosError(error) && !error.response && user) {
        await enqueueOutboxItem(user, {
          kind: 'DEMOUNT_TASK_UPDATE_STATUS',
          request: { method: 'PATCH', url: `/demount-tasks/${id}/status`, body: { status } },
          meta: { taskId: id },
        })
        const cached = (await offlineCache.demountTasksMy.get(user))?.data ?? []
        const patched = cached.map((t) => (t.id === id ? { ...t, status } : t))
        await offlineCache.demountTasksMy.set(user, patched)
        return patched.find((t) => t.id === id) ?? ({ id } as DemountTaskItem)
      }
      throw error
    }
  },

  complete: async (
    id: string,
    payload: CompleteDemountTaskPayload,
  ): Promise<DemountTaskItem> => {
    const user = useAuthStore.getState().user
    try {
      const response = await axiosInstance.post<{ data: DemountTaskItem }>(
        `/demount-tasks/${id}/complete`,
        payload,
      )
      return response.data.data
    } catch (error) {
      if (axios.isAxiosError(error) && !error.response && user) {
        await enqueueOutboxItem(user, {
          kind: 'DEMOUNT_TASK_COMPLETE',
          request: { method: 'POST', url: `/demount-tasks/${id}/complete`, body: payload },
          meta: { taskId: id },
        })
        const cached = (await offlineCache.demountTasksMy.get(user))?.data ?? []
        const patched = cached.map((t) =>
          t.id === id
            ? {
                ...t,
                status: 'COMPLETED' as const,
                completionResolution: payload.resolution,
                completionReason: payload.reason,
                completedAt: new Date().toISOString(),
              }
            : t,
        )
        await offlineCache.demountTasksMy.set(user, patched)
        return patched.find((t) => t.id === id) ?? ({ id } as DemountTaskItem)
      }
      throw error
    }
  },
};
