import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as Application from 'expo-application';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as SecureStore from 'expo-secure-store';
import { appReleasesApi, type AndroidLatestRelease } from '@/api/app-releases.api';
import { axiosInstance } from '@/api/axios.instance';
import { useAuthStore } from '@/store/auth.store';

const DEFER_KEY = 'appUpdate.deferUntil';

type GateState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'no_update' }
  | {
      kind: 'update_available';
      latest: AndroidLatestRelease;
      isMandatory: boolean;
      deferUntil: number | null;
    }
  | {
      kind: 'downloading';
      latest: AndroidLatestRelease;
      progress?: number;
      totalBytesWritten?: number;
      totalBytesExpectedToWrite?: number;
    }
  | {
      kind: 'downloaded';
      latest: AndroidLatestRelease;
      apkUri: string;
      contentUri: string;
    }
  | { kind: 'error'; message: string };

function getAndroidVersionCode(): number {
  const raw =
    // Android: nativeBuildVersion is versionCode (string)
    (Application.nativeBuildVersion as unknown as string | null | undefined) ?? '0';
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

async function getDeferUntil(): Promise<number | null> {
  const value = await SecureStore.getItemAsync(DEFER_KEY);
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function setDeferUntil(ts: number | null) {
  if (!ts) {
    await SecureStore.deleteItemAsync(DEFER_KEY);
    return;
  }
  await SecureStore.setItemAsync(DEFER_KEY, String(ts));
}

export function useAppUpdateGate() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const [state, setState] = useState<GateState>({ kind: 'idle' });

  const currentVersionCode = useMemo(() => {
    if (Platform.OS !== 'android') return 0;
    return getAndroidVersionCode();
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      setState({ kind: 'idle' });
      return;
    }
    if (Platform.OS !== 'android') {
      setState({ kind: 'no_update' });
      return;
    }

    let cancelled = false;

    (async () => {
      setState({ kind: 'checking' });

      const deferUntil = await getDeferUntil();
      const now = Date.now();
      if (deferUntil && deferUntil > now) {
        // Still deferred; do not check now (keeps server quiet and UI stable).
        setState({ kind: 'no_update' });
        return;
      }

      try {
        const latest = await appReleasesApi.getLatestAndroid();
        if (cancelled) return;

        const updateAvailable = latest.versionCode > currentVersionCode;
        if (!updateAvailable) {
          await setDeferUntil(null);
          setState({ kind: 'no_update' });
          return;
        }

        const mandatoryAfterAt = new Date(latest.mandatoryAfterAt).getTime();
        const isMandatory = now >= mandatoryAfterAt;

        setState({
          kind: 'update_available',
          latest,
          isMandatory,
          deferUntil: deferUntil ?? null,
        });
      } catch (e: any) {
        if (cancelled) return;
        setState({ kind: 'error', message: e?.message ?? 'Update check failed' });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, accessToken, currentVersionCode]);

  const actions = useMemo(() => {
    const download = async (latest: AndroidLatestRelease) => {
      try {
        setState({ kind: 'downloading', latest, progress: 0 });

        const updatesDir = `${FileSystem.documentDirectory ?? ''}updates/`;
        await FileSystem.makeDirectoryAsync(updatesDir, { intermediates: true });
        const target = `${updatesDir}sim-tracker-${latest.versionName}-${latest.versionCode}.apk`;

        const base = axiosInstance.defaults.baseURL ?? '';
        const absoluteUrl = latest.downloadUrl.startsWith('http')
          ? latest.downloadUrl
          : `${base}${latest.downloadUrl}`;

        const download = FileSystem.createDownloadResumable(
          absoluteUrl,
          target,
          {
            headers: {
              Authorization: `Bearer ${useAuthStore.getState().accessToken}`,
            },
          },
          (p) => {
            const expected = Number(p.totalBytesExpectedToWrite);
            const written = Number(p.totalBytesWritten);

            const canComputePct =
              Number.isFinite(expected) && Number.isFinite(written) && expected > 0;

            const raw = canComputePct ? written / expected : undefined;
            const progress =
              raw == null
                ? undefined
                : Number.isFinite(raw)
                  ? Math.max(0, Math.min(1, raw))
                  : undefined;

            setState({
              kind: 'downloading',
              latest,
              progress,
              totalBytesWritten: Number.isFinite(written) ? written : undefined,
              totalBytesExpectedToWrite: Number.isFinite(expected) ? expected : undefined,
            });
          },
        );

        const result = await download.downloadAsync();
        if (!result?.uri) {
          throw new Error('Download failed');
        }

        const contentUri = await FileSystem.getContentUriAsync(result.uri);
        setState({ kind: 'downloaded', latest, apkUri: result.uri, contentUri });
      } catch (e: any) {
        Alert.alert('Nadogradnja nije uspjela', e?.message ?? 'Greška pri nadogradnji');
        setState({ kind: 'error', message: e?.message ?? 'Download/install failed' });
      }
    };

    const install = async (downloaded: { contentUri: string }) => {
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: downloaded.contentUri,
        flags: 1,
        type: 'application/vnd.android.package-archive',
      });
    };

    const postpone = async (latest: AndroidLatestRelease) => {
      const now = Date.now();
      const mandatoryAfterAt = new Date(latest.mandatoryAfterAt).getTime();
      const nextPromptAt = Math.min(mandatoryAfterAt, now + 24 * 60 * 60 * 1000);
      await setDeferUntil(nextPromptAt);
      setState({ kind: 'no_update' });
    };

    return { download, install, postpone };
  }, []);

  return { state, actions };
}

