/**
 * Section — strukturalno grupisanje sadrzaja BEZ kartice (anti "card soup"
 * prema instrukcije.md §7): maleni uppercase naslov + opcioni dodatak desno.
 */
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { palette, spacing, type } from '@/theme/tokens';
import React from 'react';

export interface SectionProps {
  label?: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
  style?: ViewStyle;
  insetTop?: boolean;
}

export function Section({
  label,
  hint,
  actionLabel,
  onAction,
  children,
  style,
  insetTop = false,
}: SectionProps) {
  const hasHeader = Boolean(label || actionLabel);
  return (
    <View style={[styles.section, insetTop && styles.insetTop, style]}>
      {hasHeader ? (
        <View style={styles.headerRow}>
          <View style={styles.headerTextWrap}>
            {label ? <Text style={type.sectionLabel}>{label}</Text> : null}
            {hint ? <Text style={styles.hint}>{hint}</Text> : null}
          </View>
          {actionLabel && onAction ? (
            <Pressable onPress={onAction} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.action}>{actionLabel}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.xl },
  insetTop: { marginTop: spacing.xl },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingHorizontal: 2,
  },
  headerTextWrap: { flexShrink: 1 },
  hint: {
    marginTop: 2,
    fontSize: 12,
    color: palette.textMuted,
  },
  action: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.brand,
  },
});
