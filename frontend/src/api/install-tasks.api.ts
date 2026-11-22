import { axiosInstance } from './axios.instance'
import type { ApiEnvelope } from '@/types/common.types'

export type InstallTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

export type InstallTaskItem = {
  id: string
  meterId: string
  assignedToId: string | null
  createdById: string
  status: InstallTaskStatus
  notes?: string | null
  installationRecordId?: string | null
  completedAt?: string | null
  createdAt: string
  updatedAt: string
  meter?: {
    id: string
    serialNumber: string
    simCardState?: string
    simCard?: { iccid: string; ipAddress: string } | null
    meterTypeDefinition?: { name: string } | null
  }
  assignedTo?: { firstName: string; lastName: string }
  createdBy?: { firstName: string; lastName: string }
  installationRecord?: { id: string; recordNumber: string; status: string } | null
}

export type InstallTaskListParams = {
  page?: number
  limit?: number
  status?: InstallTaskStatus
  unassignedOnly?: boolean
  branchId?: string
  search?: string
}

export const installTasksApi = {
  list: async (
    params?: InstallTaskListParams,
  ): Promise<{
    items: InstallTaskItem[]
    total: number
    page: number
    limit: number
    totalPages: number
  }> => {
    const response = await axiosInstance.get('/install-tasks', { params })
    return response.data.data
  },

  create: async (payload: {
    meterId: string
    assignedToId: string
    notes?: string
  }): Promise<InstallTaskItem> => {
    const response = await axiosInstance.post<ApiEnvelope<InstallTaskItem>>(
      '/install-tasks',
      payload,
    )
    return response.data.data
  },

  createBulk: async (payload: {
    meterIds: string[]
    assignedToId: string
    notes?: string
  }): Promise<{
    totalRequested: number
    createdCount: number
    failedCount: number
    created: InstallTaskItem[]
    failed: Array<{ meterId: string; message: string }>
  }> => {
    const response = await axiosInstance.post<
      ApiEnvelope<{
        totalRequested: number
        createdCount: number
        failedCount: number
        created: InstallTaskItem[]
        failed: Array<{ meterId: string; message: string }>
      }>
    >('/install-tasks/bulk', payload)
    return response.data.data
  },

  updateStatus: async (id: string, status: InstallTaskStatus): Promise<InstallTaskItem> => {
    const response = await axiosInstance.patch<ApiEnvelope<InstallTaskItem>>(
      `/install-tasks/${id}/status`,
      { status },
    )
    return response.data.data
  },

  cancel: async (id: string): Promise<InstallTaskItem> => {
    const response = await axiosInstance.post<ApiEnvelope<InstallTaskItem>>(
      `/install-tasks/${id}/cancel`,
    )
    return response.data.data
  },

  reassign: async (id: string, assignedToId: string): Promise<InstallTaskItem> => {
    const response = await axiosInstance.post<ApiEnvelope<InstallTaskItem>>(
      `/install-tasks/${id}/reassign`,
      { assignedToId },
    )
    return response.data.data
  },
}

