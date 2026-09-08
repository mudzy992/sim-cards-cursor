import { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import * as Application from 'expo-application';
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
  | { kind: 'opening_browser'; latest: AndroidLatestRelease; url: string }
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
    const buildAbsoluteDownloadUrl = (latest: AndroidLatestRelease) => {
      const base = axiosInstance.defaults.baseURL ?? '';
      return latest.downloadUrl.startsWith('http')
        ? latest.downloadUrl
        : `${base}${latest.downloadUrl}`;
    };

    const openInBrowser = async (latest: AndroidLatestRelease) => {
      try {
        const url = buildAbsoluteDownloadUrl(latest);
        setState({ kind: 'opening_browser', latest, url });
        const canOpen = await Linking.canOpenURL(url);
        if (!canOpen) throw new Error('Ne mogu otvoriti link u browseru.');
        await Linking.openURL(url);
      } catch (e: any) {
        Alert.alert(
          'Nadogradnja nije uspjela',
          e?.message ?? 'Ne mogu otvoriti download u browseru.',
        );
        setState({ kind: 'error', message: e?.message ?? 'Browser open failed' });
      }
    };

    const postpone = async (latest: AndroidLatestRelease) => {
      const now = Date.now();
      const mandatoryAfterAt = new Date(latest.mandatoryAfterAt).getTime();
      const nextPromptAt = Math.min(mandatoryAfterAt, now + 24 * 60 * 60 * 1000);
      await setDeferUntil(nextPromptAt);
      setState({ kind: 'no_update' });
    };

    return { openInBrowser, postpone };
  }, []);

  return { state, actions };
}

