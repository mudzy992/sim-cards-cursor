import { axiosInstance } from './axios.instance';

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
  getMy: async (): Promise<MySettings> => {
    const response = await axiosInstance.get<MySettings>('/settings/me');
    return response.data;
  },

  updateMy: async (data: Partial<MySettings>): Promise<MySettings> => {
    const response = await axiosInstance.patch<MySettings>('/settings/me', data);
    return response.data;
  },
};

