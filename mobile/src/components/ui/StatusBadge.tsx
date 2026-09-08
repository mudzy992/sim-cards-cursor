/**
 * StatusBadge — semanticka oznaka stanja (pill je DOZVOLJEN jedino za statuse
 * prema instrukcije.md §8). Success / warning / danger / info / neutral.
 */
import { StyleSheet, Text, View } from 'react-native';
import { palette, radii, spacing } from '@/theme/tokens';

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface StatusBadgeProps {
  tone?: StatusTone;
  label: string;
  /** tackica ispred teksta — korisno za "zive" statuse (online, pending) */
  showDot?: boolean;
}

export function StatusBadge({ tone = 'neutral', label, showDot = false }: StatusBadgeProps) {
  const colors = toneMap[tone];
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: colors.bg, borderColor: colors.border },
      ]}
    >
      {showDot ? <View style={[styles.dot, { backgroundColor: colors.text }]} /> : null}
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

const toneMap: Record<StatusTone, { bg: string; border: string; text: string }> = {
  success: { bg: palette.successSoft, border: palette.successBorder, text: palette.success },
  warning: { bg: palette.warningSoft, border: palette.warningBorder, text: palette.warning },
  danger: { bg: palette.dangerSoft, border: palette.dangerBorder, text: palette.danger },
  info: { bg: palette.infoSoft, border: palette.infoBorder, text: palette.info },
  neutral: { bg: palette.surfaceMuted, border: palette.border, text: palette.textSecondary },
};

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
