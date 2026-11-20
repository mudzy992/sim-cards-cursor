import { Stack } from 'expo-router';
import { palette } from '@/theme/tokens';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        statusBarStyle: 'light',
        contentStyle: { backgroundColor: palette.graphite },
      }}
    />
  );
}