import { axiosInstance } from './axios.instance';
import type { ApiEnvelope } from '@/types/common.types';

export interface Recipient {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  position?: string;
  isActive: boolean;
  groupId: string;
}

export type RecipientGroupType = 'PDF' | 'APPROVAL';

export interface RecipientGroupUser {
  recipientGroupId: string;
  userId: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  };
}

export interface RecipientGroup {
  id: string;
  name: string;
  description?: string;
  type?: RecipientGroupType;
  distributionId?: string;
  recipients: Recipient[];
  groupUsers?: RecipientGroupUser[];
}

export interface BranchApprovalMapping {
  id: string;
  branchId: string;
  recipientGroupId: string;
  branch: { id: string; name: string; code: string; distributionId: string };
  recipientGroup: { id: string; name: string };
}

export const recipientsApi = {
  listGroups: async (): Promise<RecipientGroup[]> => {
    const response = await axiosInstance.get<ApiEnvelope<RecipientGroup[]>>(
      '/recipients/groups',
    );
    return response.data.data;
  },

  getGroup: async (id: string): Promise<RecipientGroup> => {
    const response = await axiosInstance.get<ApiEnvelope<RecipientGroup>>(
      `/recipients/groups/${id}`,
    );
    return response.data.data;
  },

  createGroup: async (data: {
    name: string;
    description?: string;
    type?: RecipientGroupType;
    distributionId?: string;
  }): Promise<RecipientGroup> => {
    const response = await axiosInstance.post<ApiEnvelope<RecipientGroup>>(
      '/recipients/groups',
      data,
    );
    return response.data.data;
  },

  updateGroup: async (
    id: string,
    data: { name?: string; description?: string; type?: RecipientGroupType; distributionId?: string },
  ): Promise<RecipientGroup> => {
    const response = await axiosInstance.patch<ApiEnvelope<RecipientGroup>>(
      `/recipients/groups/${id}`,
      data,
    );
    return response.data.data;
  },

  deleteGroup: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/recipients/groups/${id}`);
  },

  createRecipient: async (data: {
    email: string;
    firstName: string;
    lastName: string;
    position?: string;
    isActive?: boolean;
    groupId: string;
  }): Promise<Recipient> => {
    const response = await axiosInstance.post<ApiEnvelope<Recipient>>(
      '/recipients',
      data,
    );
    return response.data.data;
  },

  updateRecipient: async (
    id: string,
    data: Partial<{
      email: string;
      firstName: string;
      lastName: string;
      position: string;
      isActive: boolean;
      groupId: string;
    }>,
  ): Promise<Recipient> => {
    const response = await axiosInstance.patch<ApiEnvelope<Recipient>>(
      `/recipients/${id}`,
      data,
    );
    return response.data.data;
  },

  deleteRecipient: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/recipients/${id}`);
  },

  getBranchApprovalMappings: async (
    distributionId?: string,
  ): Promise<BranchApprovalMapping[]> => {
    const response = await axiosInstance.get<ApiEnvelope<BranchApprovalMapping[]>>(
      '/recipients/branch-approval-mappings',
      { params: distributionId ? { distributionId } : undefined },
    );
    return response.data.data;
  },

  setBranchApprovalGroup: async (
    branchId: string,
    recipientGroupId: string,
  ): Promise<{ branchId: string; recipientGroupId: string }> => {
    const response = await axiosInstance.post<
      ApiEnvelope<{ branchId: string; recipientGroupId: string }>
    >('/recipients/branch-approval-mappings', { branchId, recipientGroupId });
    return response.data.data;
  },

  removeBranchApprovalGroup: async (branchId: string): Promise<void> => {
    await axiosInstance.delete(`/recipients/branch-approval-mappings/${branchId}`);
  },

  addUserToGroup: async (
    recipientGroupId: string,
    userId: string,
  ): Promise<{ recipientGroupId: string; userId: string }> => {
    const response = await axiosInstance.post<
      ApiEnvelope<{ recipientGroupId: string; userId: string }>
    >(`/recipients/groups/${recipientGroupId}/users`, { userId });
    return response.data.data;
  },

  removeUserFromGroup: async (
    recipientGroupId: string,
    userId: string,
  ): Promise<void> => {
    await axiosInstance.delete(
      `/recipients/groups/${recipientGroupId}/users/${userId}`,
    );
  },

  getGroupUsers: async (
    recipientGroupId: string,
  ): Promise<RecipientGroupUser[]> => {
    const response = await axiosInstance.get<
      ApiEnvelope<RecipientGroupUser[]>
    >(`/recipients/groups/${recipientGroupId}/users`);
    return response.data.data;
  },

  getUsersForPicker: async (): Promise<
    { id: string; email: string; firstName: string; lastName: string }[]
  > => {
    const response = await axiosInstance.get<
      ApiEnvelope<
        { id: string; email: string; firstName: string; lastName: string }[]
      >
    >('/recipients/users-for-picker');
    return response.data.data;
  },
};
