import { axiosInstance } from './axios.instance';
import type { ApiEnvelope } from '@/types/common.types';
import type {
  MeterTypeDefinitionItem,
  CreateMeterTypeDefinitionInput,
  UpdateMeterTypeDefinitionInput,
} from '@/types/meter-type-definition.types';

const baseUrl = '/meter-type-definitions';

export const meterTypeDefinitionsApi = {
  listAll: async (): Promise<MeterTypeDefinitionItem[]> => {
    const response = await axiosInstance.get<ApiEnvelope<MeterTypeDefinitionItem[]>>(
      `${baseUrl}/list`,
    );
    return response.data.data;
  },

  list: async (params?: {
    page?: number;
    limit?: number;
  }): Promise<MeterTypeDefinitionItem[]> => {
    const response = await axiosInstance.get<ApiEnvelope<MeterTypeDefinitionItem[]>>(
      baseUrl,
      { params },
    );
    return response.data.data;
  },

  get: async (id: string): Promise<MeterTypeDefinitionItem> => {
    const response = await axiosInstance.get<ApiEnvelope<MeterTypeDefinitionItem>>(
      `${baseUrl}/${id}`,
    );
    return response.data.data;
  },

  create: async (
    data: CreateMeterTypeDefinitionInput,
  ): Promise<MeterTypeDefinitionItem> => {
    const response = await axiosInstance.post<ApiEnvelope<MeterTypeDefinitionItem>>(
      baseUrl,
      data,
    );
    return response.data.data;
  },

  update: async (
    id: string,
    data: UpdateMeterTypeDefinitionInput,
  ): Promise<MeterTypeDefinitionItem> => {
    const response = await axiosInstance.patch<ApiEnvelope<MeterTypeDefinitionItem>>(
      `${baseUrl}/${id}`,
      data,
    );
    return response.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await axiosInstance.delete(`${baseUrl}/${id}`);
  },

  remove: async (id: string): Promise<void> => {
    await axiosInstance.delete(`${baseUrl}/${id}`);
  },
};
