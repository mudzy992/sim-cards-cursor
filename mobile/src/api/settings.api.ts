import { axiosInstance } from './axios.instance';
import { readPersistedJson, writePersistedJson } from '@/offline/persisted-json'

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

const MOBILE_PUSH_CACHE_KEY = 'settings.mobilePushEnabled'

type MobilePushCache = {
  enabled: boolean
  updatedAt: string
}

export const settingsApi = {
  getMobilePushEnabled: async (): Promise<boolean> => {
    const cached = await readPersistedJson<MobilePushCache>(MOBILE_PUSH_CACHE_KEY)
    try {
      const response = await axiosInstance.get('/settings/mobile-push');
      const payload = response.data as any;
      const enabled =
        (payload?.data?.enabled as boolean | undefined) ??
        (payload?.enabled as boolean | undefined);
      const normalized = typeof enabled === 'boolean' ? enabled : true
      await writePersistedJson(MOBILE_PUSH_CACHE_KEY, {
        enabled: normalized,
        updatedAt: new Date().toISOString(),
      })
      return normalized
    } catch {
      console.warn(
        '[Settings] Ne mogu pročitati mobile-push flag, fallback na cached vrijednost (ili enabled=false)',
      );
      return cached?.enabled ?? false
    }
  },

  getMy: async (): Promise<MySettings> => {
    const response = await axiosInstance.get<MySettings>('/settings/me');
    return response.data;
  },

  updateMy: async (data: Partial<MySettings>): Promise<MySettings> => {
    const response = await axiosInstance.patch<MySettings>('/settings/me', data);
    return response.data;
  },
};
