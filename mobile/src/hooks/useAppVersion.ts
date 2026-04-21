import { useMemo } from 'react';
import * as Application from 'expo-application';
import Constants from 'expo-constants';

export type AppVersionInfo = {
  versionName: string;
  buildNumber: string;
};

function safeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  return v.length ? v : null;
}

export function useAppVersion(): AppVersionInfo {
  return useMemo(() => {
    const versionName =
      safeString(Constants.expoConfig?.version) ??
      safeString(Application.nativeApplicationVersion) ??
      '—';

    const buildNumber = safeString(Application.nativeBuildVersion) ?? '—';

    return { versionName, buildNumber };
  }, []);
}

