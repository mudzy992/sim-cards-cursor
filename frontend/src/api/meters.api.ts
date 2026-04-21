import { axiosInstance } from './axios.instance';
import type { ApiEnvelope } from '@/types/common.types';
import type {
  MeterItem,
  MetersListParams,
  MetersResponse,
  CreateMeterInput,
  UpdateMeterInput,
  MeterDeleteSummary,
  DeleteMeterWithConfirmInput,
} from '@/types/meter.types';

export const metersApi = {
  list: async (params?: MetersListParams): Promise<MetersResponse> => {
    const response = await axiosInstance.get<ApiEnvelope<MetersResponse>>(
      '/meters',
      { params },
    );
    return response.data.data;
  },

  create: async (meter: CreateMeterInput): Promise<MeterItem> => {
    const response = await axiosInstance.post<ApiEnvelope<MeterItem>>(
      '/meters',
      meter,
    );
    return response.data.data;
  },

  get: async (id: string): Promise<MeterItem> => {
    const response = await axiosInstance.get<ApiEnvelope<MeterItem>>(
      `/meters/${id}`,
    );
    return response.data.data;
  },

  update: async (id: string, meter: UpdateMeterInput): Promise<MeterItem> => {
    const response = await axiosInstance.patch<ApiEnvelope<MeterItem>>(
      `/meters/${id}`,
      meter,
    );
    return response.data.data;
  },

  remove: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/meters/${id}`);
  },

  getDeleteSummary: async (id: string): Promise<MeterDeleteSummary> => {
    const response = await axiosInstance.get<ApiEnvelope<MeterDeleteSummary>>(
      `/meters/${id}/delete-summary`,
    );
    return response.data.data;
  },

  deleteWithConfirm: async (
    id: string,
    payload: DeleteMeterWithConfirmInput,
  ): Promise<{ deleted: boolean; deletedRecordsCount: number }> => {
    const response = await axiosInstance.post<
      ApiEnvelope<{ deleted: boolean; deletedRecordsCount: number }>
    >(`/meters/${id}/delete`, payload);
    return response.data.data;
  },

  getAvailable: async (): Promise<MeterItem[]> => {
    const response = await axiosInstance.get<ApiEnvelope<MeterItem[]>>(
      '/meters/available',
    );
    return response.data.data;
  },
};
