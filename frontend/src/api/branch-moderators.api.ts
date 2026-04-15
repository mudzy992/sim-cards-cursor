import { axiosInstance } from './axios.instance'
import type { ApiEnvelope } from '@/types/common.types'
import type { AssignBranchModeratorInput, BranchModeratorItem } from '@/types/branch-moderator.types'

const baseUrl = '/branch-moderators'

export const branchModeratorsApi = {
  list: async (params?: { branchId?: string; userId?: string }): Promise<BranchModeratorItem[]> => {
    const response = await axiosInstance.get<ApiEnvelope<BranchModeratorItem[]>>(baseUrl, {
      params: params ?? {},
    })
    return response.data.data
  },

  assign: async (data: AssignBranchModeratorInput): Promise<BranchModeratorItem> => {
    const response = await axiosInstance.post<ApiEnvelope<BranchModeratorItem>>(baseUrl, data)
    return response.data.data
  },

  remove: async (id: string): Promise<void> => {
    await axiosInstance.delete(`${baseUrl}/${id}`)
  },
}
