import { axiosInstance } from './axios.instance';
import type { ApiEnvelope } from '@/types/common.types';
import type {
  SimCardItem,
  SimCardListParams,
  SimCardsResponse,
  ModeratedInstalledSimCardsResponse,
  SimEventItem,
} from '@/types/sim-card.types';

export const simCardsApi = {
  list: async (params?: SimCardListParams): Promise<SimCardsResponse> => {
    const response = await axiosInstance.get<ApiEnvelope<SimCardsResponse>>('/sim-cards', {
      params,
    });
    return response.data.data;
  },

  moderatedInstalled: async (
    params?: SimCardListParams,
  ): Promise<ModeratedInstalledSimCardsResponse> => {
    const response = await axiosInstance.get<ApiEnvelope<ModeratedInstalledSimCardsResponse>>(
      '/sim-cards/moderated-installed',
      { params },
    );
    return response.data.data;
  },

  myAssigned: async (params?: SimCardListParams): Promise<SimCardsResponse> => {
    const response = await axiosInstance.get<ApiEnvelope<SimCardsResponse>>(
      '/sim-cards/my-assigned',
      { params },
    );
    return response.data.data;
  },
  getById: async (id: string): Promise<SimCardItem> => {
    const response = await axiosInstance.get<ApiEnvelope<SimCardItem>>(`/sim-cards/${id}`);
    return response.data.data;
  },

  listEvents: async (id: string): Promise<SimEventItem[]> => {
    const response = await axiosInstance.get<ApiEnvelope<SimEventItem[]>>(
      `/sim-cards/${id}/events`,
    );
    return response.data.data;
  },
  assign: async (id: string, userId: string) => {
    const response = await axiosInstance.post(`/sim-cards/${id}/assign`, { userId });
    return response.data.data;
  },
  unassign: async (id: string) => {
    const response = await axiosInstance.post(`/sim-cards/${id}/unassign`);
    return response.data.data;
  },
};
