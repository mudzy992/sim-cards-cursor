import { axiosInstance } from './axios.instance';
import type { ApiEnvelope } from '@/types/common.types';

export type MobileAppRelease = {
  id: string;
  platform: 'ANDROID';
  versionName: string;
  versionCode: number;
  apkPath: string;
  apkFileName: string;
  apkSha256: string;
  releaseNotes: string | null;
  publishedAt: string;
  mandatoryAfterAt: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
};

export type AndroidLatestWithMeta = MobileAppRelease & {
  downloadUrl: string;
  graceDays: number;
};

export const appReleasesApi = {
  listAndroid: async (): Promise<MobileAppRelease[]> => {
    const response = await axiosInstance.get<
      ApiEnvelope<MobileAppRelease[]>
    >('/app-releases/android'); // if this 404s we can easily adjust backend later
    return response.data.data;
  },

  uploadAndroid: async (input: {
    versionName: string;
    versionCode: number;
    releaseNotes?: string;
    file: File;
  }): Promise<MobileAppRelease> => {
    const form = new FormData();
    form.append('versionName', input.versionName);
    form.append('versionCode', String(input.versionCode));
    if (input.releaseNotes) {
      form.append('releaseNotes', input.releaseNotes);
    }
    form.append('file', input.file);

    const response = await axiosInstance.post<
      ApiEnvelope<MobileAppRelease>
    >('/app-releases/android', form);
    return response.data.data;
  },

  latestAndroid: async (): Promise<AndroidLatestWithMeta> => {
    const response = await axiosInstance.get<
      ApiEnvelope<AndroidLatestWithMeta | null>
    >('/app-releases/android/latest');
    return response.data.data;
  },
};

