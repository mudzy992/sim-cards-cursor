import { axiosInstance } from './axios.instance'
import type { ApiEnvelope } from '@/types/common.types'

export type InstallTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

export type InstallTaskItem = {
  id: string
  meterId: string
  assignedToId: string
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

export const installTasksApi = {
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
}

