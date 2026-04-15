import { axiosInstance } from './axios.instance';

export type MeterTypeDefinitionItem = {
  id: string;
  name: string;
  manufacturer?: string | null;
  model?: string | null;
  type: string;
  maxCurrent?: string | null;
  notes?: string | null;
};

export type MeterFieldType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'DATE';

export type MeterTypeFieldItem = {
  id: string;
  meterTypeDefinitionId: string;
  name: string;
  label: string;
  fieldType: MeterFieldType;
  isRequired: boolean;
  isOperatorFillable: boolean;
  defaultValue?: string | null;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
};

export const meterTypeDefinitionsApi = {
  list: async (): Promise<MeterTypeDefinitionItem[]> => {
    const response = await axiosInstance.get<{ data: MeterTypeDefinitionItem[] }>(
      '/meter-type-definitions/list',
    );
    const data = response.data?.data ?? response.data;
    return Array.isArray(data) ? data : [];
  },

  listFields: async (meterTypeDefinitionId: string): Promise<MeterTypeFieldItem[]> => {
    const response = await axiosInstance.get<{ data: MeterTypeFieldItem[] }>(
      `/meter-type-definitions/${meterTypeDefinitionId}/fields`,
    );
    const data = response.data?.data ?? response.data;
    return Array.isArray(data) ? data : [];
  },
};
