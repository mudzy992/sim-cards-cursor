/**
 * ActionButton — standardizovanu glavnu akciju u aplikaciji.
 * Varijante: primary (brand), secondary (obican), ghost, danger, dark.
 * Podrska: loading spinner, ikonu, disabled stanje, tri velicine.
 */
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HIT_TARGET, palette, radii, spacing } from '@/theme/tokens';

export type ActionButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark';
export type ActionButtonSize = 'sm' | 'md' | 'lg';

export interface ActionButtonProps {
  title: string;
  onPress: () => void;
  variant?: ActionButtonVariant;
  size?: ActionButtonSize;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export function ActionButton(props: ActionButtonProps) {
  const {
    title,
    onPress,
    variant = 'primary',
    size = 'md',
    icon,
    loading = false,
    disabled = false,
    fullWidth = true,
    style,
  } = props;

  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        sizeStyles[size],
        fullWidth && styles.fullWidth,
        borderStyle(variant),
        { backgroundColor: backgroundFor(variant, pressed, inactive) },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'secondary' || variant === 'ghost' ? palette.brand : palette.inverse}
        />
      ) : (
        <View style={styles.content}>
          {icon ? (
            <Ionicons
              name={icon}
              size={size === 'sm' ? 16 : 18}
              color={textColorFor(variant)}
              style={styles.icon}
            />
          ) : null}
          <Text style={[styles.text, textSizeStyles[size], { color: textColorFor(variant) }]}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

function backgroundFor(variant: ActionButtonVariant, pressed: boolean, inactive: boolean): string {
  if (inactive) {
    switch (variant) {
      case 'secondary':
      case 'ghost':
        return 'transparent';
      default:
        return palette.borderStrong;
    }
  }
  switch (variant) {
    case 'primary':
      return pressed ? palette.brandPressed : palette.brand;
    case 'secondary':
      return pressed ? palette.surfaceMuted : palette.surface;
    case 'ghost':
      return pressed ? palette.surfaceMuted : 'transparent';
    case 'danger':
      return pressed ? '#991B1B' : palette.danger;
    case 'dark':
      return pressed ? palette.graphiteSoft : palette.graphite;
  }
}

function borderStyle(variant: ActionButtonVariant): ViewStyle | null {
  switch (variant) {
    case 'secondary':
      return { borderWidth: 1, borderColor: palette.borderStrong };
    default:
      return null;
  }
}

function textColorFor(variant: ActionButtonVariant): string {
  switch (variant) {
    case 'primary':
    case 'danger':
    case 'dark':
      return palette.inverse;
    case 'secondary':
      return palette.textPrimary;
    case 'ghost':
      return palette.brand;
  }
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  fullWidth: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  icon: { marginRight: spacing.sm },
  text: { fontWeight: '600', letterSpacing: 0.1 },
});

const sizeStyles = StyleSheet.create({
  sm: { minHeight: 36, paddingVertical: 6 },
  md: { minHeight: HIT_TARGET, paddingVertical: 10 },
  lg: { minHeight: 52, paddingVertical: 14 },
});

const textSizeStyles = StyleSheet.create({
  sm: { fontSize: 13 },
  md: { fontSize: 15 },
  lg: { fontSize: 16 },
});
