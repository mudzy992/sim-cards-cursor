import { Stack } from 'expo-router';
import { palette } from '@/theme/tokens';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        statusBarStyle: 'light',
        statusBarColor: palette.graphite,
        contentStyle: { backgroundColor: palette.graphite },
      }}
    />
  );
}