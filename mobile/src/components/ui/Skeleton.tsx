import { useEffect, useRef } from 'react';
import { Animated, View, type ViewStyle } from 'react-native';
import {
  radii,
  spacing,
  useThemedStyles,
  type ThemePalette,
} from '@/theme/tokens';

export interface SkeletonProps {
  width?: number | string;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

export function Skeleton({
  width = '100%',
  height = 16,
  radius = radii.sm,
  style,
}: SkeletonProps) {
  const styles = useThemedStyles(createStyles);
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.base,
        {
          width: width as ViewStyle['width'],
          height,
          borderRadius: radius,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function SkeletonRow({ style }: { style?: ViewStyle }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.row, style]}>
      <Skeleton width={36} height={36} radius={radii.sm} />
      <View style={styles.rowBody}>
        <Skeleton width="62%" height={14} />
        <Skeleton width="38%" height={12} style={styles.rowGap} />
      </View>
    </View>
  );
}

export function SkeletonRows({
  count = 4,
  style,
}: {
  count?: number;
  style?: ViewStyle;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={style}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonRow key={i} style={styles.rowsGap} />
      ))}
    </View>
  );
}

const createStyles = (palette: ThemePalette) => ({
  base: { backgroundColor: palette.surfaceSunken },
  row: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.md },
  rowBody: { flex: 1 },
  rowGap: { marginTop: spacing.sm },
  rowsGap: { marginBottom: spacing.lg },
});
