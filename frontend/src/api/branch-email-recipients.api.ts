import { axiosInstance } from './axios.instance'
import type { ApiEnvelope } from '@/types/common.types'
import type {
  BranchEmailRecipientItem,
  CreateBranchEmailRecipientInput,
  UpdateBranchEmailRecipientInput,
} from '@/types/branch-email-recipient.types'

const baseUrl = '/branch-email-recipients'

export const branchEmailRecipientsApi = {
  list: async (params?: { branchId?: string }): Promise<BranchEmailRecipientItem[]> => {
    const response = await axiosInstance.get<ApiEnvelope<BranchEmailRecipientItem[]>>(baseUrl, {
      params: params ?? {},
    })
    return response.data.data
  },

  create: async (data: CreateBranchEmailRecipientInput): Promise<BranchEmailRecipientItem> => {
    const response = await axiosInstance.post<ApiEnvelope<BranchEmailRecipientItem>>(baseUrl, data)
    return response.data.data
  },

  update: async (
    id: string,
    data: UpdateBranchEmailRecipientInput,
  ): Promise<BranchEmailRecipientItem> => {
    const response = await axiosInstance.patch<ApiEnvelope<BranchEmailRecipientItem>>(
      `${baseUrl}/${id}`,
      data,
    )
    return response.data.data
  },

  remove: async (id: string): Promise<void> => {
    await axiosInstance.delete(`${baseUrl}/${id}`)
  },
}
