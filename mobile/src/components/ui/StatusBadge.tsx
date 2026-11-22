import { StyleSheet, Text, View } from 'react-native';
import { radii, spacing, useTheme } from '@/theme/tokens';

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface StatusBadgeProps {
  tone?: StatusTone;
  label: string;
  showDot?: boolean;
}

export function StatusBadge({
  tone = 'neutral',
  label,
  showDot = false,
}: StatusBadgeProps) {
  const { palette } = useTheme();
  const toneMap: Record<StatusTone, { bg: string; border: string; text: string }> = {
    success: {
      bg: palette.successSoft,
      border: palette.successBorder,
      text: palette.success,
    },
    warning: {
      bg: palette.warningSoft,
      border: palette.warningBorder,
      text: palette.warning,
    },
    danger: {
      bg: palette.dangerSoft,
      border: palette.dangerBorder,
      text: palette.danger,
    },
    info: {
      bg: palette.infoSoft,
      border: palette.infoBorder,
      text: palette.info,
    },
    neutral: {
      bg: palette.surfaceSunken,
      border: palette.borderStrong,
      text: palette.textSecondary,
    },
  };

  const badgeColors = toneMap[tone];
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: badgeColors.bg, borderColor: badgeColors.border },
      ]}
    >
      {showDot ? (
        <View style={[styles.dot, { backgroundColor: badgeColors.text }]} />
      ) : null}
      <Text style={[styles.label, { color: badgeColors.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.2 },
});
