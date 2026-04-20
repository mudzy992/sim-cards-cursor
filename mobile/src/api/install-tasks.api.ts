import { axiosInstance } from './axios.instance'
import axios from 'axios'
import { useAuthStore } from '@/store/auth.store'
import { offlineCache } from '@/offline/offline-cache'
import { enqueueOutboxItem } from '@/offline/outbox'

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
  createdBy?: { id: string; firstName: string; lastName: string } | null
  meter?: {
    id: string
    serialNumber: string
    status?: string
    simCardState?: string
    meterTypeDefinitionId?: string
    meterTypeDefinition?: { id: string; name: string } | null
    isDemountedFromLocation?: boolean
    dynamicFieldValues?: Record<string, unknown> | null
    installationAddress?: string | null
    installationDate?: string | null
    city?: string | null
    municipality?: string | null
    measuringPoint?: string | null
    latitude?: number | null
    longitude?: number | null
    calibrationYear?: number | null
  }
  installationRecord?: { id: string; recordNumber: string; status: string } | null
}

export type CompleteInstallTaskPayload = {
  simCardId: string
  recordNotes?: string
  calibrationYear?: number
  installationAddress?: string
  installationDate?: string
  city?: string
  municipality?: string
  measuringPoint?: string
  latitude?: number
  longitude?: number
  dynamicFieldValues?: Record<string, unknown>
}

export const installTasksApi = {
  getMy: async (params?: { status?: InstallTaskStatus }): Promise<InstallTaskItem[]> => {
    const user = useAuthStore.getState().user
    try {
      const response = await axiosInstance.get<{ data: InstallTaskItem[] }>(
        '/install-tasks/my',
        { params },
      )
      const data = response.data?.data ?? response.data
      const list = Array.isArray(data) ? data : []
      if (user && !params?.status) await offlineCache.installTasksMy.set(user, list)
      return list
    } catch (error) {
      if (axios.isAxiosError(error) && !error.response && user && !params?.status) {
        return (await offlineCache.installTasksMy.get(user))?.data ?? []
      }
      throw error
    }
  },

  updateStatus: async (id: string, status: InstallTaskStatus): Promise<InstallTaskItem> => {
    const user = useAuthStore.getState().user
    try {
      const response = await axiosInstance.patch<{ data: InstallTaskItem }>(
        `/install-tasks/${id}/status`,
        { status },
      )
      return response.data.data
    } catch (error) {
      if (axios.isAxiosError(error) && !error.response && user) {
        await enqueueOutboxItem(user, {
          kind: 'INSTALL_TASK_UPDATE_STATUS',
          request: { method: 'PATCH', url: `/install-tasks/${id}/status`, body: { status } },
          meta: { taskId: id },
        })
        const cached = (await offlineCache.installTasksMy.get(user))?.data ?? []
        const patched = cached.map((t) => (t.id === id ? { ...t, status } : t))
        await offlineCache.installTasksMy.set(user, patched)
        return patched.find((t) => t.id === id) ?? ({ id } as InstallTaskItem)
      }
      throw error
    }
  },

  complete: async (id: string, payload: CompleteInstallTaskPayload): Promise<InstallTaskItem> => {
    const user = useAuthStore.getState().user
    try {
      const response = await axiosInstance.post<{ data: InstallTaskItem }>(
        `/install-tasks/${id}/complete`,
        payload,
      )
      return response.data.data
    } catch (error) {
      if (axios.isAxiosError(error) && !error.response && user) {
        await enqueueOutboxItem(user, {
          kind: 'INSTALL_TASK_COMPLETE',
          request: { method: 'POST', url: `/install-tasks/${id}/complete`, body: payload },
          meta: { taskId: id, simCardId: payload.simCardId },
        })
        const cached = (await offlineCache.installTasksMy.get(user))?.data ?? []
        const patched = cached.map((t) =>
          t.id === id
            ? {
                ...t,
                status: 'COMPLETED' as const,
                completedAt: new Date().toISOString(),
              }
            : t,
        )
        await offlineCache.installTasksMy.set(user, patched)
        return patched.find((t) => t.id === id) ?? ({ id } as InstallTaskItem)
      }
      throw error
    }
  },
}

