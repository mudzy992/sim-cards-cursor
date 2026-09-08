/**
 * SegmentedFilter — kompaktna segmentirana kontrola (iOS-style).
 * Zamjenjuje razvucene "chip" filtere: segmenti dijele jednaku sirinu,
 * traka je niska (~38pt), a brojaci su male oznake uz labelu.
 */
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { palette, radii, shadows, spacing } from '@/theme/tokens';

export interface SegmentOption<T extends string> {
  key: T;
  label: string;
  /** opcioni brojac; 0 i undefined se ne prikazuju */
  count?: number;
}

export interface SegmentedFilterProps<T extends string> {
  options: Array<SegmentOption<T>>;
  value: T;
  onChange: (value: T) => void;
  style?: ViewStyle;
}

export function SegmentedFilter<T extends string>({
  options,
  value,
  onChange,
  style,
}: SegmentedFilterProps<T>) {
  return (
    <View style={[styles.track, style]}>
      {options.map((option) => {
        const active = option.key === value;
        const count = option.count ?? 0;
        const showCount = count > 0;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.segment,
              active && styles.segmentActive,
              pressed && !active ? styles.pressed : null,
            ]}
          >
            <Text numberOfLines={1} style={[styles.label, active && styles.labelActive]}>
              {option.label}
            </Text>
            {showCount ? (
              <View style={[styles.badge, active && styles.badgeActive]}>
                <Text style={[styles.badgeText, active && styles.badgeTextActive]}>
                  {count > 99 ? '99+' : count}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: palette.surfaceSunken,
    borderRadius: radii.sm,
    padding: 3,
    gap: 2,
  },
  segment: {
    flex: 1,
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: radii.sm - 2,
    paddingHorizontal: spacing.sm,
  },
  segmentActive: {
    backgroundColor: palette.surface,
    ...(shadows.card as object),
  },
  pressed: { opacity: 0.6 },
  label: {
    fontSize: 12.5,
    fontWeight: '600',
    color: palette.textMuted,
    flexShrink: 1,
  },
  labelActive: { color: palette.textPrimary },
  badge: {
    minWidth: 17,
    height: 17,
    borderRadius: 8.5,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.borderStrong,
  },
  badgeActive: { backgroundColor: palette.brand },
  badgeText: { fontSize: 10, fontWeight: '700', color: palette.surface },
  badgeTextActive: { color: palette.inverse },
});
