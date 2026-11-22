import { ActivityIndicator, View } from 'react-native';
import { useTheme } from '@/theme/tokens';

export function LoadingScreen() {
  const { palette } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: palette.background,
      }}
    >
      <ActivityIndicator size="large" color={palette.brandText} />
    </View>
  );
}
