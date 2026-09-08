/**
 * Panel — diskretna okvirna povrsina za SMISLENE grupe sadrzaja
 * (instrukcije.md §7: kartica mora opravdati zasto sadrzaj pripada skupa).
 * Bez utegnutih senki; vodi se neutralnim borderom.
 */
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { palette, radii, spacing } from '@/theme/tokens';
import React from 'react';

export interface PanelProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: keyof typeof paddingMap;
  tone?: 'default' | 'warning' | 'danger' | 'info' | 'success';
}

const paddingMap = {
  none: 0,
  md: spacing.md,
  lg: spacing.lg,
  xl: spacing.xl,
} as const;

const toneMap = {
  default: { bg: palette.surface, border: palette.border },
  warning: { bg: palette.warningSoft, border: palette.warningBorder },
  danger: { bg: palette.dangerSoft, border: palette.dangerBorder },
  info: { bg: palette.infoSoft, border: palette.infoBorder },
  success: { bg: palette.successSoft, border: palette.successBorder },
} as const;

export function Panel({ children, style, padding = 'lg', tone = 'default' }: PanelProps) {
  return (
    <View
      style={[
        styles.panel,
        {
          backgroundColor: toneMap[tone].bg,
          borderColor: toneMap[tone].border,
          padding: paddingMap[padding],
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: radii.lg,
    borderWidth: 1,
  },
});
