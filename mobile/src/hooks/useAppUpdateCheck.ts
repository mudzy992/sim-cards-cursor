import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { Linking } from 'react-native';
import {
  appReleasesApi,
  type AndroidLatestRelease,
} from '@/api/app-releases.api';
import { axiosInstance } from '@/api/axios.instance';
import { useAppVersion } from '@/hooks/useAppVersion';
import { useConnectivity } from '@/hooks/useConnectivity';

export interface AppUpdateState {
  release: AndroidLatestRelease | null;
  hasUpdate: boolean;
  isMandatory: boolean;
  downloadUrl: string | null;
  isChecking: boolean;
  checkNow: () => Promise<AppUpdateCheckResult>;
  openDownload: () => Promise<boolean>;
}

export interface AppUpdateCheckResult {
  release: AndroidLatestRelease | null;
  hasUpdate: boolean;
  downloadUrl: string | null;
}

export function resolveReleaseDownloadUrl(rawUrl?: string | null): string | null {
  const trimmed = rawUrl?.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const base = (axiosInstance.defaults.baseURL ?? '').replace(/\/+$/, '');
  if (!base) return trimmed;
  return `${base}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
}

export function isNewerAndroidRelease(
  release: AndroidLatestRelease | null | undefined,
  localVersionName: string,
  localBuildNumber: string,
): boolean {
  if (!release) return false;
  const parsedBuild = Number.parseInt(localBuildNumber, 10);
  if (Number.isFinite(parsedBuild) && parsedBuild > 0) {
    return release.versionCode > parsedBuild;
  }
  const cleanLocal = localVersionName.trim();
  const cleanRemote = release.versionName?.trim();
  if (!cleanRemote || !cleanLocal || cleanLocal === '—') return false;
  return cleanRemote !== cleanLocal;
}

export function isMandatoryRelease(
  release: AndroidLatestRelease | null | undefined,
): boolean {
  if (!release?.mandatoryAfterAt?.trim()) return false;
  const target = new Date(release.mandatoryAfterAt).getTime();
  return Number.isFinite(target) && Date.now() >= target;
}

export function useAppUpdateCheck(): AppUpdateState {
  const { isOnline } = useConnectivity();
  const { versionName, buildNumber } = useAppVersion();

  const query = useQuery({
    queryKey: ['android-latest-release'],
    queryFn: () => appReleasesApi.getLatestAndroid(),
    enabled: isOnline,
    staleTime: 1000 * 60 * 15,
    retry: false,
  });

  const release = query.data ?? null;
  const hasUpdate = isNewerAndroidRelease(release, versionName, buildNumber);
  const isMandatory = hasUpdate && isMandatoryRelease(release);
  const downloadUrl = resolveReleaseDownloadUrl(release?.downloadUrl);

  const checkNow = useCallback(async (): Promise<AppUpdateCheckResult> => {
    const res = await query.refetch();
    const latest = res.data ?? null;
    return {
      release: latest,
      hasUpdate: isNewerAndroidRelease(latest, versionName, buildNumber),
      downloadUrl: resolveReleaseDownloadUrl(latest?.downloadUrl),
    };
  }, [query, versionName, buildNumber]);

  const openDownload = useCallback(async (): Promise<boolean> => {
    if (!downloadUrl) return false;
    try {
      await Linking.openURL(downloadUrl);
      return true;
    } catch {
      return false;
    }
  }, [downloadUrl]);

  return {
    release,
    hasUpdate,
    isMandatory,
    downloadUrl,
    isChecking: query.isFetching,
    checkNow,
    openDownload,
  };
}
