import { ActivityIndicator, View } from 'react-native';
import { palette } from '@/theme/tokens';

export function LoadingScreen() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: palette.background,
      }}
    >
      <ActivityIndicator size="large" color={palette.brand} />
    </View>
  );
}