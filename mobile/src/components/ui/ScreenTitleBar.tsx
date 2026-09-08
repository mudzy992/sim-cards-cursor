/** Jedinstven naslov tab ekrana, sa opcionom desnom akcijom. */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, spacing, type } from '@/theme/tokens';

export function ScreenTitleBar({
  title,
  subtitle,
  actionIcon,
  actionLabel,
  onAction,
}: {
  title: string;
  subtitle?: string;
  actionIcon?: keyof typeof Ionicons.glyphMap;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.body}>
        <Text style={type.screenTitle}>{title}</Text>
        {subtitle ? <Text style={[type.caption, styles.subtitle]}>{subtitle}</Text> : null}
      </View>
      {onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" style={styles.action} hitSlop={6}>
          {actionIcon ? <Ionicons name={actionIcon} size={18} color={palette.brand} /> : null}
          {actionLabel ? <Text style={styles.actionText}>{actionLabel}</Text> : null}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  body: { flex: 1, minWidth: 0 },
  subtitle: { marginTop: 2 },
  action: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: spacing.md },
  actionText: { color: palette.brand, fontSize: 14, fontWeight: '600' },
});