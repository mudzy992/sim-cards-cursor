/**
 * EmptyState — smisleno prazno stanje: ikonica, naslov, opis i akcija.
 * Instrukcije: empty state objasnjava stanje i predlaze sljedeci korak.
 */
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, radii, spacing, type } from '@/theme/tokens';
import { ActionButton, type ActionButtonVariant } from './ActionButton';
import React from 'react';

export interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionVariant?: ActionButtonVariant;
  style?: ViewStyle;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  actionVariant = 'secondary',
  style,
}: EmptyStateProps) {
  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={28} color={palette.textMuted} />
      </View>
      <Text style={[type.bodyStrong, styles.title]}>{title}</Text>
      {description ? <Text style={[type.caption, styles.description]}>{description}</Text> : null}
      {actionLabel && onAction ? (
        <View style={styles.actionWrap}>
          <ActionButton
            title={actionLabel}
            onPress={onAction}
            variant={actionVariant}
            size="sm"
            fullWidth={false}
            style={styles.action}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radii.lg,
    backgroundColor: palette.surfaceMuted,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: { textAlign: 'center' },
  description: { marginTop: spacing.sm, textAlign: 'center', lineHeight: 19 },
  actionWrap: { marginTop: spacing.lg },
  action: { minWidth: 160 },
});
