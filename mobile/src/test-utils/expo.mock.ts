import React from 'react';

export function Ionicons(props: Record<string, unknown>) {
  return React.createElement('Ionicons', props);
}

export function SafeAreaView({
  children,
  ...rest
}: Record<string, unknown> & { children?: React.ReactNode }) {
  return React.createElement('SafeAreaView', rest, children);
}

export function useSafeAreaInsets() {
  return { top: 0, right: 0, bottom: 0, left: 0 };
}

const secureStoreMemory = new Map<string, string>();

export async function getItemAsync(key: string): Promise<string | null> {
  return secureStoreMemory.get(key) ?? null;
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  secureStoreMemory.set(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  secureStoreMemory.delete(key);
}

export const requestCameraPermissionsAsync = jest.fn(async () => ({
  status: 'granted',
}));
export const requestMediaLibraryPermissionsAsync = jest.fn(async () => ({
  status: 'granted',
}));
export const launchCameraAsync = jest.fn(async () => ({
  canceled: true,
  assets: [],
}));
export const launchImageLibraryAsync = jest.fn(async () => ({
  canceled: true,
  assets: [],
}));

export const nativeApplicationVersion = '1.0.0';
export const nativeBuildVersion = '10';

export const cacheDirectory = 'file:///tmp/cache/';
export const documentDirectory = 'file:///tmp/docs/';
export const deleteAsync = jest.fn(async () => {});
export const getInfoAsync = jest.fn(async () => ({ exists: false }));
export const makeDirectoryAsync = jest.fn(async () => {});
export const readAsStringAsync = jest.fn(async () => '');
export const writeAsStringAsync = jest.fn(async () => {});

export const impactAsync = jest.fn(async () => {});
export const notificationAsync = jest.fn(async () => {});
export const ImpactFeedbackStyle = { Light: 'light', Medium: 'medium', Heavy: 'heavy' };
export const NotificationFeedbackType = {
  Success: 'success',
  Warning: 'warning',
  Error: 'error',
};

export const addEventListener = jest.fn(() => jest.fn());
export const fetch = jest.fn(async () => ({
  isConnected: true,
  isInternetReachable: true,
}));

export const getContentUriAsync = jest.fn(
  async (uri: string) => `content://ba.epbih.simtracker.fileprovider/${uri}`,
);
export const createDownloadResumable = jest.fn(
  (
    _url: string,
    fileUri: string,
    _options?: unknown,
    onProgress?: (data: {
      totalBytesWritten: number;
      totalBytesExpectedToWrite: number;
    }) => void,
  ) => ({
    downloadAsync: jest.fn(async () => {
      onProgress?.({ totalBytesWritten: 50, totalBytesExpectedToWrite: 100 });
      onProgress?.({ totalBytesWritten: 100, totalBytesExpectedToWrite: 100 });
      return { uri: fileUri, status: 200 };
    }),
    pauseAsync: jest.fn(async () => ({})),
  }),
);
export const startActivityAsync = jest.fn(async () => ({ resultCode: -1 }));

export default {
  expoConfig: { version: '1.0.0' },
  addEventListener,
  fetch,
  cacheDirectory,
  getContentUriAsync,
  createDownloadResumable,
  startActivityAsync,
};
