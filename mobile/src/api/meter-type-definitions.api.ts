import { axiosInstance } from './axios.instance';
import axios from 'axios'
import { useAuthStore } from '@/store/auth.store'
import { offlineCache } from '@/offline/offline-cache'

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
    const user = useAuthStore.getState().user
    try {
      const response = await axiosInstance.get<{ data: MeterTypeDefinitionItem[] }>(
        '/meter-type-definitions/list',
      )
      const data = response.data?.data ?? response.data
      const list = Array.isArray(data) ? data : []
      if (user) await offlineCache.meterTypeDefinitions.set(user, list)
      return list
    } catch (error) {
      if (axios.isAxiosError(error) && !error.response && user) {
        return (await offlineCache.meterTypeDefinitions.get(user))?.data ?? []
      }
      throw error
    }
  },

  listFields: async (meterTypeDefinitionId: string): Promise<MeterTypeFieldItem[]> => {
    const user = useAuthStore.getState().user
    try {
      const response = await axiosInstance.get<{ data: MeterTypeFieldItem[] }>(
        `/meter-type-definitions/${meterTypeDefinitionId}/fields`,
      )
      const data = response.data?.data ?? response.data
      const list = Array.isArray(data) ? data : []
      if (user) await offlineCache.meterTypeFields.set(user, meterTypeDefinitionId, list)
      return list
    } catch (error) {
      if (axios.isAxiosError(error) && !error.response && user) {
        return (await offlineCache.meterTypeFields.get(user, meterTypeDefinitionId))?.data ?? []
      }
      throw error
    }
  },
};
