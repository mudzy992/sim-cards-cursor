import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  spacing,
  useTheme,
  useThemedStyles,
  type ThemePalette,
} from '@/theme/tokens';

export function ScreenTitleBar({
  title,
  subtitle,
  onBack,
  actionIcon,
  actionLabel,
  onAction,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  actionIcon?: keyof typeof Ionicons.glyphMap;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { palette, type } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.row}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Nazad"
          hitSlop={6}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={22} color={palette.textPrimary} />
        </Pressable>
      ) : null}
      <View style={styles.body}>
        <Text style={type.screenTitle}>{title}</Text>
        {subtitle ? (
          <Text style={[type.caption, styles.subtitle]}>{subtitle}</Text>
        ) : null}
      </View>
      {onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          style={styles.action}
          hitSlop={6}
        >
          {actionIcon ? (
            <Ionicons name={actionIcon} size={18} color={palette.brandText} />
          ) : null}
          {actionLabel ? (
            <Text style={styles.actionText}>{actionLabel}</Text>
          ) : null}
        </Pressable>
      ) : null}
    </View>
  );
}

const createStyles = (palette: ThemePalette) => ({
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  body: { flex: 1, minWidth: 0 },
  back: {
    width: 40,
    height: 44,
    alignItems: 'flex-start' as const,
    justifyContent: 'center' as const,
  },
  pressed: { opacity: 0.55 },
  subtitle: { marginTop: 2 },
  action: {
    minHeight: 44,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingLeft: spacing.md,
  },
  actionText: {
    color: palette.brandText,
    fontSize: 14,
    fontWeight: '600' as const,
  },
});
