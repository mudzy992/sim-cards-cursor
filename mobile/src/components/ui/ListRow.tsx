/**
 * ListRow — univerzalni strukturalni red (alternativa karticama za liste).
 * Leading ikonica (opcionalno tonalna), naslov/podnaslov, trailing vrijednost,
 * chevron za navigaciju, tanki divider ispred redoslijeda.
 */
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, radii, spacing, type } from '@/theme/tokens';
import type { StatusTone } from './StatusBadge';
import React from 'react';

const toneColorMap: Record<StatusTone, { bg: string; text: string }> = {
  success: { bg: palette.successSoft, text: palette.success },
  warning: { bg: palette.warningSoft, text: palette.warning },
  danger: { bg: palette.dangerSoft, text: palette.danger },
  info: { bg: palette.infoSoft, text: palette.info },
  neutral: { bg: palette.surfaceMuted, text: palette.textSecondary },
};

export interface ListRowProps {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconTone?: StatusTone;
  /** ispisano desno (mono broj ili custom node) */
  value?: string | number;
  valueMono?: boolean;
  trailing?: React.ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  divider?: boolean;
  style?: ViewStyle;
}

export function ListRow(props: ListRowProps) {
  const {
    title,
    subtitle,
    icon,
    iconTone = 'neutral',
    value,
    valueMono = false,
    trailing,
    onPress,
    chevron,
    divider = false,
    style,
  } = props;

  const showChevron = chevron ?? Boolean(onPress);
  const tones = toneColorMap[iconTone];

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [
        styles.row,
        divider && styles.divider,
        pressed && onPress ? styles.pressed : null,
        style,
      ]}
    >
      {icon ? (
        <View style={[styles.iconWrap, { backgroundColor: tones.bg }]}>
          <Ionicons name={icon} size={18} color={tones.text} />
        </View>
      ) : null}
      <View style={styles.body}>
        <Text style={type.bodyStrong} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[type.caption, styles.subtitle]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value !== undefined && value !== null ? (
        <Text style={valueMono ? type.data : type.bodyStrong} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {trailing}
      {showChevron ? (
        <Ionicons name="chevron-forward" size={16} color={palette.textMuted} style={styles.chevron} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: 2,
    gap: spacing.md,
  },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border },
  pressed: { opacity: 0.7 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, minWidth: 0 },
  subtitle: { marginTop: 2 },
  chevron: { marginLeft: spacing.xs },
});
