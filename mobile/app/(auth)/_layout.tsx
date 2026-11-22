import { Stack } from 'expo-router';
import { useTheme } from '@/theme/tokens';

export default function AuthLayout() {
  const { palette } = useTheme();
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
