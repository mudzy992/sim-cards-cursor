import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text, View } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import {
  computeDownloadProgress,
  isMandatoryRelease,
  isNewerAndroidRelease,
  resolveReleaseDownloadUrl,
  useAppUpdateCheck,
} from '../useAppUpdateCheck';
import type { AndroidLatestRelease } from '@/api/app-releases.api';
import { appReleasesApi } from '@/api/app-releases.api';

jest.mock('@/api/axios.instance', () => ({
  axiosInstance: {
    defaults: { baseURL: 'https://api.simtracker.ba101.top/' },
  },
}));

const sampleRelease: AndroidLatestRelease = {
  id: 'rel-1',
  platform: 'ANDROID',
  versionCode: 12,
  versionName: '1.2.0',
  apkFileName: 'sim-tracker-1.2.0.apk',
  apkSha256: 'abc123',
  releaseNotes: 'Bugfixes',
  mandatoryAfterAt: '',
  graceDays: 7,
  publishedAt: '2026-11-18T12:00:00.000Z',
  createdAt: '2026-11-18T12:00:00.000Z',
  updatedAt: '2026-11-18T12:00:00.000Z',
  downloadUrl: '/app-releases/android/12/download',
};

describe('useAppUpdateCheck helpers', () => {
  it('resolves relative and absolute release download URLs', () => {
    expect(resolveReleaseDownloadUrl('/app-releases/android/12/download')).toBe(
      'https://api.simtracker.ba101.top/app-releases/android/12/download',
    );
    expect(
      resolveReleaseDownloadUrl('https://cdn.example.com/simtracker.apk'),
    ).toBe('https://cdn.example.com/simtracker.apk');
    expect(resolveReleaseDownloadUrl('   ')).toBeNull();
  });

  it('compares numeric build numbers when available', () => {
    expect(isNewerAndroidRelease(sampleRelease, '1.0.0', '10')).toBe(true);
    expect(isNewerAndroidRelease(sampleRelease, '1.2.0', '12')).toBe(false);
    expect(isNewerAndroidRelease(sampleRelease, '1.3.0', '15')).toBe(false);
  });

  it('falls back to versionName comparison when native build number is unavailable', () => {
    expect(isNewerAndroidRelease(sampleRelease, '1.0.0', '—')).toBe(true);
    expect(isNewerAndroidRelease(sampleRelease, '1.2.0', '—')).toBe(false);
    expect(isNewerAndroidRelease(null, '1.0.0', '10')).toBe(false);
  });

  it('detects mandatory release cutoff timestamps', () => {
    expect(
      isMandatoryRelease({
        ...sampleRelease,
        mandatoryAfterAt: new Date(Date.now() - 60_000).toISOString(),
      }),
    ).toBe(true);
    expect(
      isMandatoryRelease({
        ...sampleRelease,
        mandatoryAfterAt: new Date(Date.now() + 86_400_000).toISOString(),
      }),
    ).toBe(false);
    expect(isMandatoryRelease(sampleRelease)).toBe(false);
  });

  it('computes normalized download progress within [0, 1]', () => {
    expect(computeDownloadProgress(50, 100)).toBe(0.5);
    expect(computeDownloadProgress(150, 100)).toBe(1);
    expect(computeDownloadProgress(10, 0)).toBeNull();
    expect(computeDownloadProgress(-5, 100)).toBeNull();
  });
});

describe('useAppUpdateCheck hook downloadAndInstall', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(appReleasesApi, 'getLatestAndroid').mockResolvedValue(sampleRelease);
  });

  it('downloads APK and launches Android package installer intent', async () => {
    let lastResult: boolean | null = null;

    function TestHarness() {
      const update = useAppUpdateCheck();
      return (
        <View>
          <Text testID="has-update">{String(update.hasUpdate)}</Text>
          <Pressable
            testID="trigger-download"
            onPress={() => {
              void update.downloadAndInstall().then((ok) => {
                lastResult = ok;
              });
            }}
          />
        </View>
      );
    }

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await render(
      <QueryClientProvider client={qc}>
        <TestHarness />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('has-update').props.children).toBe('true');
    });

    await fireEvent.press(screen.getByTestId('trigger-download'));

    await waitFor(() => {
      expect(lastResult).toBe(true);
    });

    expect(FileSystem.createDownloadResumable).toHaveBeenCalledWith(
      'https://api.simtracker.ba101.top/app-releases/android/12/download',
      'file:///tmp/cache/sim-tracker-update-12.apk',
      {},
      expect.any(Function),
    );
    expect(FileSystem.getContentUriAsync).toHaveBeenCalledWith(
      'file:///tmp/cache/sim-tracker-update-12.apk',
    );
    expect(IntentLauncher.startActivityAsync).toHaveBeenCalledWith(
      'android.intent.action.VIEW',
      expect.objectContaining({
        type: 'application/vnd.android.package-archive',
        data: 'content://ba.epbih.simtracker.fileprovider/file:///tmp/cache/sim-tracker-update-12.apk',
      }),
    );
  });
});
