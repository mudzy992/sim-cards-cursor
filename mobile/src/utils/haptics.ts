import { Platform, Vibration } from 'react-native';

function safeVibrate(pattern: number | number[]): void {
  if (Platform.OS === 'web') return;
  try {
    Vibration.vibrate(pattern);
  } catch {
    // ignore on platforms without vibration hardware
  }
}

export function hapticTap(): void {
  safeVibrate(15);
}

export function hapticSuccess(): void {
  safeVibrate([0, 30, 50, 40]);
}

export function hapticWarning(): void {
  safeVibrate([0, 45, 40, 45]);
}

export function hapticError(): void {
  safeVibrate([0, 70, 50, 70]);
}
