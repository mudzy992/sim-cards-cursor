import { useQuery } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { Linking, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import {
  appReleasesApi,
  type AndroidLatestRelease,
} from '@/api/app-releases.api';
import { axiosInstance } from '@/api/axios.instance';
import { useAppVersion } from '@/hooks/useAppVersion';
import { useConnectivity } from '@/hooks/useConnectivity';

const FLAG_GRANT_READ_URI_PERMISSION = 1;
const FLAG_ACTIVITY_NEW_TASK = 268435456;

export interface AppUpdateState {
  release: AndroidLatestRelease | null;
  hasUpdate: boolean;
  isMandatory: boolean;
  downloadUrl: string | null;
  isChecking: boolean;
  isDownloading: boolean;
  downloadProgress: number | null;
  downloadError: string | null;
  checkNow: () => Promise<AppUpdateCheckResult>;
  openDownload: () => Promise<boolean>;
  downloadAndInstall: () => Promise<boolean>;
  cancelDownload: () => Promise<void>;
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

export function computeDownloadProgress(
  totalBytesWritten: number,
  totalBytesExpectedToWrite: number,
): number | null {
  if (
    !Number.isFinite(totalBytesExpectedToWrite) ||
    totalBytesExpectedToWrite <= 0 ||
    !Number.isFinite(totalBytesWritten) ||
    totalBytesWritten < 0
  ) {
    return null;
  }
  return Math.max(0, Math.min(1, totalBytesWritten / totalBytesExpectedToWrite));
}

export function useAppUpdateCheck(): AppUpdateState {
  const { isOnline } = useConnectivity();
  const { versionName, buildNumber } = useAppVersion();
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const activeDownloadRef = useRef<FileSystem.DownloadResumable | null>(null);
  const cancelledRef = useRef(false);

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

  const cancelDownload = useCallback(async (): Promise<void> => {
    cancelledRef.current = true;
    const current = activeDownloadRef.current;
    activeDownloadRef.current = null;
    if (current) {
      try {
        await current.pauseAsync();
      } catch {
        // Ignore pause errors when cancelling an already finished stream
      }
    }
    setIsDownloading(false);
    setDownloadProgress(null);
  }, []);

  const downloadAndInstall = useCallback(async (): Promise<boolean> => {
    if (!downloadUrl) return false;
    setDownloadError(null);

    if (Platform.OS !== 'android' || !FileSystem.cacheDirectory) {
      try {
        await Linking.openURL(downloadUrl);
        return true;
      } catch {
        return false;
      }
    }

    const versionTag = release?.versionCode ?? 'latest';
    const targetUri = `${FileSystem.cacheDirectory}sim-tracker-update-${versionTag}.apk`;

    cancelledRef.current = false;
    setIsDownloading(true);
    setDownloadProgress(0);

    const downloadResumable = FileSystem.createDownloadResumable(
      downloadUrl,
      targetUri,
      {},
      (progressData) => {
        const nextProgress = computeDownloadProgress(
          progressData.totalBytesWritten,
          progressData.totalBytesExpectedToWrite,
        );
        if (nextProgress !== null) {
          setDownloadProgress(nextProgress);
        }
      },
    );
    activeDownloadRef.current = downloadResumable;

    try {
      const result = await downloadResumable.downloadAsync();
      if (cancelledRef.current) {
        return false;
      }
      if (!result || (result.status !== undefined && result.status >= 400)) {
        setDownloadError('download_failed');
        return false;
      }

      setDownloadProgress(1);
      const contentUri = await FileSystem.getContentUriAsync(result.uri);
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: FLAG_GRANT_READ_URI_PERMISSION | FLAG_ACTIVITY_NEW_TASK,
        type: 'application/vnd.android.package-archive',
      });
      return true;
    } catch {
      if (!cancelledRef.current) {
        try {
          await Linking.openURL(downloadUrl);
          return true;
        } catch {
          setDownloadError('download_failed');
        }
      }
      return false;
    } finally {
      activeDownloadRef.current = null;
      setIsDownloading(false);
      setDownloadProgress(null);
    }
  }, [downloadUrl, release?.versionCode]);

  const openDownload = useCallback(async (): Promise<boolean> => {
    return downloadAndInstall();
  }, [downloadAndInstall]);

  return {
    release,
    hasUpdate,
    isMandatory,
    downloadUrl,
    isChecking: query.isFetching,
    isDownloading,
    downloadProgress,
    downloadError,
    checkNow,
    openDownload,
    downloadAndInstall,
    cancelDownload,
  };
}
