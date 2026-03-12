import { axiosInstance } from './axios.instance';
import type { ApiEnvelope } from '@/types/common.types';

export type PushCampaignAudienceType = 'ALL' | 'FILTER' | 'USER';
export type PushCampaignStatus = 'DRAFT' | 'SENDING' | 'SENT' | 'PARTIAL' | 'FAILED';

export type PushCampaign = {
  id: string;
  createdById: string;
  scopeDistributionId: string | null;
  scopeBranchId: string | null;
  title: string;
  message: string;
  deepLink: string | null;
  audienceType: PushCampaignAudienceType;
  filters: unknown | null;
  targetUserId: string | null;
  status: PushCampaignStatus;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
};

export type PushDeliveryStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED' | 'INVALID_TOKEN';

export type PushDeliveryListItem = {
  id: string;
  campaignId: string;
  userId: string;
  pushTokenId: string;
  expoTicketId: string | null;
  status: PushDeliveryStatus;
  errorCode: string | null;
  errorMessage: string | null;
  receiptCheckedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    distributionId: string | null;
    branchId: string | null;
  };
  pushToken: {
    id: string;
    platform: string | null;
    deviceId: string | null;
    token: string;
    isValid: boolean;
  };
};

export const pushCampaignsApi = {
  createDraft: async (input: {
    title: string;
    message: string;
    deepLink?: string;
    audienceType: PushCampaignAudienceType;
    filters?: Record<string, unknown>;
    targetUserId?: string;
  }): Promise<PushCampaign> => {
    const response = await axiosInstance.post<ApiEnvelope<PushCampaign>>(
      '/push-campaigns',
      input,
    );
    return response.data.data;
  },

  send: async (id: string) => {
    const response = await axiosInstance.post<ApiEnvelope<unknown>>(
      `/push-campaigns/${id}/send`,
    );
    return response.data.data;
  },

  list: async (params?: {
    status?: PushCampaignStatus;
    page?: number;
    limit?: number;
  }): Promise<{
    items: PushCampaign[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }> => {
    const response = await axiosInstance.get<
      ApiEnvelope<{
        items: PushCampaign[];
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      }>
    >('/push-campaigns', { params });
    return response.data.data;
  },

  stats: async (id: string): Promise<{
    queued: number;
    sent: number;
    delivered: number;
    failed: number;
    invalid: number;
    total: number;
  }> => {
    const response = await axiosInstance.get<
      ApiEnvelope<{
        queued: number;
        sent: number;
        delivered: number;
        failed: number;
        invalid: number;
        total: number;
      }>
    >(`/push-campaigns/${id}/stats`);
    return response.data.data;
  },

  recipients: async (
    id: string,
    params?: { page?: number; limit?: number },
  ): Promise<{
    items: PushDeliveryListItem[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }> => {
    const response = await axiosInstance.get<
      ApiEnvelope<{
        items: PushDeliveryListItem[];
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      }>
    >(`/push-campaigns/${id}/recipients`, { params });
    return response.data.data;
  },
};

