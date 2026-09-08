/**
 * Skeleton — standardizovani loading placeholderi (umjesto ActivityIndicator
 * za strukturirane ekrane; instrukcije: "loading states vazni").
 */
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type ViewStyle } from 'react-native';
import { palette, radii, spacing } from '@/theme/tokens';

export interface SkeletonProps {
  width?: number | string;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 16, radius = radii.sm, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.base,
        { width: width as ViewStyle['width'], height, borderRadius: radius, opacity },
        style,
      ]}
    />
  );
}

/** Red obican za liste: kruzic + dvije linije. */
export function SkeletonRow({ style }: { style?: ViewStyle }) {
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

export function SkeletonRows({ count = 4, style }: { count?: number; style?: ViewStyle }) {
  return (
    <View style={style}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonRow key={i} style={styles.rowsGap} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: palette.surfaceMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowBody: { flex: 1 },
  rowGap: { marginTop: spacing.sm },
  rowsGap: { marginBottom: spacing.lg },
});
