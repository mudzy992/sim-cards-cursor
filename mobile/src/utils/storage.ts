import * as SecureStore from 'expo-secure-store';
import type { AuthUser } from '@/types/auth.types';

const SESSION_KEY = 'sim_tracker_session';
const MINI_TOUR_KEY = 'sim_tracker_mobile_mini_tour';

type StoredSession = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};

export async function saveSession(session: StoredSession): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function loadSession(): Promise<StoredSession | null> {
  const value = await SecureStore.getItemAsync(SESSION_KEY);
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as StoredSession;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

export async function hasSeenMobileMiniTour(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(MINI_TOUR_KEY);
  return value === 'true';
}

export async function setMobileMiniTourSeen(): Promise<void> {
  await SecureStore.setItemAsync(MINI_TOUR_KEY, 'true');
}
