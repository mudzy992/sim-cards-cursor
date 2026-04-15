import { axiosInstance } from './axios.instance';
import type { ApiEnvelope } from '@/types/common.types';
import type {
  MeterTypeDefinitionItem,
  CreateMeterTypeDefinitionInput,
  UpdateMeterTypeDefinitionInput,
} from '@/types/meter-type-definition.types';
import type {
  CreateMeterTypeFieldInput,
  MeterTypeFieldItem,
  UpdateMeterTypeFieldInput,
} from '@/types/meter-type-field.types'

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

  listFields: async (definitionId: string): Promise<MeterTypeFieldItem[]> => {
    const response = await axiosInstance.get<ApiEnvelope<MeterTypeFieldItem[]>>(
      `${baseUrl}/${definitionId}/fields`,
    )
    return response.data.data
  },

  createField: async (
    definitionId: string,
    data: CreateMeterTypeFieldInput,
  ): Promise<MeterTypeFieldItem> => {
    const response = await axiosInstance.post<ApiEnvelope<MeterTypeFieldItem>>(
      `${baseUrl}/${definitionId}/fields`,
      data,
    )
    return response.data.data
  },

  updateField: async (
    definitionId: string,
    fieldId: string,
    data: UpdateMeterTypeFieldInput,
  ): Promise<MeterTypeFieldItem> => {
    const response = await axiosInstance.patch<ApiEnvelope<MeterTypeFieldItem>>(
      `${baseUrl}/${definitionId}/fields/${fieldId}`,
      data,
    )
    return response.data.data
  },

  removeField: async (definitionId: string, fieldId: string): Promise<void> => {
    await axiosInstance.delete(`${baseUrl}/${definitionId}/fields/${fieldId}`)
  },

  reorderFields: async (definitionId: string, fieldIds: string[]): Promise<MeterTypeFieldItem[]> => {
    const response = await axiosInstance.put<ApiEnvelope<MeterTypeFieldItem[]>>(
      `${baseUrl}/${definitionId}/fields/reorder`,
      { fieldIds },
    )
    return response.data.data
  },
};
