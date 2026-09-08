import { axiosInstance } from './axios.instance';
import { readPersistedJson, writePersistedJson } from '@/offline/persisted-json';
import type { ApiEnvelope } from '@/types/api.types';

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
  /**
   * Javni GET `/settings/mobile-push` — backend vraća `enabled` kao
   * `notifications.push.enabled` AND `mobile.push.enabled`.
   */
  getMobilePushEnabled: async (): Promise<boolean> => {
    const cached = await readPersistedJson<MobilePushCache>(MOBILE_PUSH_CACHE_KEY);
    try {
      const response = await axiosInstance.get<ApiEnvelope<{ enabled: boolean }>>(
        '/settings/mobile-push',
      );
      const enabled = response.data.data.enabled;
      const normalized = typeof enabled === 'boolean' ? enabled : true;
      await writePersistedJson(MOBILE_PUSH_CACHE_KEY, {
        enabled: normalized,
        updatedAt: new Date().toISOString(),
      });
      return normalized;
    } catch {
      console.warn(
        '[Settings] Ne mogu pročitati mobile-push flag, fallback na cached vrijednost (ili enabled=false)',
      );
      return cached?.enabled ?? false;
    }
  },

  getMy: async (): Promise<MySettings> => {
    const response = await axiosInstance.get<ApiEnvelope<MySettings>>('/settings/me');
    return response.data.data;
  },

  updateMy: async (data: Partial<MySettings>): Promise<MySettings> => {
    const response = await axiosInstance.patch<ApiEnvelope<MySettings>>('/settings/me', data);
    return response.data.data;
  },
};
