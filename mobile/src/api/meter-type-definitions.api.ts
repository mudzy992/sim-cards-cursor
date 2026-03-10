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

export const meterTypeDefinitionsApi = {
  list: async (): Promise<MeterTypeDefinitionItem[]> => {
    const response = await axiosInstance.get<{ data: MeterTypeDefinitionItem[] }>(
      '/meter-type-definitions/list',
    );
    const data = response.data?.data ?? response.data;
    return Array.isArray(data) ? data : [];
  },
};
