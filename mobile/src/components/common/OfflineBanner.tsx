import { Ionicons } from '@expo/vector-icons';
import type { LayoutChangeEvent } from 'react-native';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConnectivity } from '@/hooks/useConnectivity';
import { palette, spacing } from '@/theme/tokens';

export function OfflineBanner({ onHeight }: { onHeight?: (height: number) => void }) {
  const { isOnline } = useConnectivity();
  const insets = useSafeAreaInsets();
  if (isOnline) return null;

  const contentTopPadding =
    Platform.OS === 'ios' ? Math.max(insets.top, 10) : Math.max(insets.top, 0) + 6;

  return (
    <View
      style={[styles.banner, { paddingTop: contentTopPadding }]}
      onLayout={(event: LayoutChangeEvent) => onHeight?.(event.nativeEvent.layout.height)}
    >
      <Ionicons name="cloud-offline-outline" size={17} color={palette.warning} />
      <Text style={styles.text} numberOfLines={2}>
        Offline režim · promjene će se poslati kada se mreža vrati
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: palette.warningSoft,
    borderBottomWidth: 1,
    borderBottomColor: palette.warningBorder,
    paddingHorizontal: spacing.md,
    paddingBottom: 4,
  },
  text: { flex: 1, color: palette.warning, fontWeight: '700', fontSize: 12 },
});