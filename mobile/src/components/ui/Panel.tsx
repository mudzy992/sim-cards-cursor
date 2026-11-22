import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { radii, spacing, useTheme } from '@/theme/tokens';

export interface PanelProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: keyof typeof paddingMap;
  tone?: 'default' | 'warning' | 'danger' | 'info' | 'success';
  testID?: string;
}

const paddingMap = {
  none: 0,
  md: spacing.md,
  lg: spacing.lg,
  xl: spacing.xl,
} as const;

export function Panel({
  children,
  style,
  padding = 'lg',
  tone = 'default',
  testID,
}: PanelProps) {
  const { palette } = useTheme();
  const toneMap = {
    default: { bg: palette.surface, border: palette.border },
    warning: { bg: palette.warningSoft, border: palette.warningBorder },
    danger: { bg: palette.dangerSoft, border: palette.dangerBorder },
    info: { bg: palette.infoSoft, border: palette.infoBorder },
    success: { bg: palette.successSoft, border: palette.successBorder },
  } as const;

  return (
    <View
      testID={testID}
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
