import { axiosInstance } from './axios.instance';
import type { ApiEnvelope } from '@/types/common.types';

export interface AppSetting {
  id: string;
  key: string;
  value: string;
  description?: string;
}

export type WebTourRoleState = {
  completedAt?: string | null;
};

export type WebTourState = {
  systemAdmin?: WebTourRoleState;
  moderator?: WebTourRoleState;
  lastVersionSeen?: string | null;
};

export type MobileTourState = {
  completedAt?: string | null;
};

export type UserTourState = {
  web?: WebTourState;
  mobile?: MobileTourState;
};

export interface MySettings {
  tour?: UserTourState;
}

export const settingsApi = {
  list: async (): Promise<AppSetting[]> => {
    const response = await axiosInstance.get<ApiEnvelope<AppSetting[]>>(
      '/settings',
    );
    return response.data.data;
  },

  getByKey: async (key: string): Promise<AppSetting> => {
    const response = await axiosInstance.get<ApiEnvelope<AppSetting>>(
      `/settings/${encodeURIComponent(key)}`,
    );
    return response.data.data;
  },

  update: async (
    key: string,
    data: { value: string; description?: string },
  ): Promise<AppSetting> => {
    const response = await axiosInstance.patch<ApiEnvelope<AppSetting>>(
      `/settings/${encodeURIComponent(key)}`,
      data,
    );
    return response.data.data;
  },

  getMy: async (): Promise<MySettings> => {
    const response = await axiosInstance.get<ApiEnvelope<MySettings>>(
      '/settings/me',
    );
    return response.data.data;
  },

  updateMy: async (data: Partial<MySettings>): Promise<MySettings> => {
    const response = await axiosInstance.patch<ApiEnvelope<MySettings>>(
      '/settings/me',
      data,
    );
    return response.data.data;
  },
};
