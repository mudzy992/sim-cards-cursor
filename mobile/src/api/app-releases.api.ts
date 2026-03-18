import { axiosInstance } from './axios.instance';

export type AndroidLatestRelease = {
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
  downloadUrl: string;
  graceDays: number;
};

export const appReleasesApi = {
  getLatestAndroid: async (): Promise<AndroidLatestRelease> => {
    const response = await axiosInstance.get<{ data: AndroidLatestRelease }>(
      '/app-releases/android/latest',
    );
    return response.data.data;
  },
};

