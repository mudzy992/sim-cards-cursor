import {
  isMandatoryRelease,
  isNewerAndroidRelease,
  resolveReleaseDownloadUrl,
} from '../useAppUpdateCheck';
import type { AndroidLatestRelease } from '@/api/app-releases.api';

jest.mock('@/api/axios.instance', () => ({
  axiosInstance: {
    defaults: { baseURL: 'https://api.simtracker.ba101.top/' },
  },
}));

describe('useAppUpdateCheck helpers', () => {
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
});
