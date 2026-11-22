import {
  Pressable,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  radii,
  spacing,
  useTheme,
  useThemedStyles,
  type ThemePalette,
} from '@/theme/tokens';

export interface FieldProps extends TextInputProps {
  label: string;
  required?: boolean;
  error?: string | null;
  helper?: string | null;
  trailingAction?: {
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
    accessibilityLabel: string;
  };
}

export function Field({
  label,
  required,
  error,
  helper,
  style,
  multiline,
  trailingAction,
  ...inputProps
}: FieldProps) {
  const { palette, type } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.wrap}>
      <Text style={type.sectionLabel}>
        {label}
        {required ? ' *' : ''}
      </Text>
      <View style={styles.inputRow}>
        <TextInput
          {...inputProps}
          multiline={multiline}
          placeholderTextColor={palette.textMuted}
          style={[
            styles.input,
            trailingAction ? styles.inputWithAction : null,
            multiline && styles.multiline,
            error ? styles.inputError : null,
            style,
          ]}
        />
        {trailingAction ? (
          <Pressable
            onPress={trailingAction.onPress}
            accessibilityRole="button"
            accessibilityLabel={trailingAction.accessibilityLabel}
            style={({ pressed }) => [
              styles.trailingBtn,
              pressed && styles.trailingPressed,
            ]}
          >
            <Ionicons
              name={trailingAction.icon}
              size={20}
              color={palette.brandText}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : helper ? (
        <Text style={styles.helper}>{helper}</Text>
      ) : null}
    </View>
  );
}

const createStyles = (palette: ThemePalette) => ({
  wrap: { marginBottom: spacing.lg },
  inputRow: {
    marginTop: spacing.sm,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 46,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: palette.surface,
    color: palette.textPrimary,
    fontSize: 15,
  },
  inputWithAction: {
    paddingRight: spacing.md,
  },
  trailingBtn: {
    width: 46,
    height: 46,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    backgroundColor: palette.brandSoft,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  trailingPressed: { opacity: 0.7 },
  multiline: { minHeight: 92, textAlignVertical: 'top' as const },
  inputError: { borderColor: palette.danger },
  error: {
    marginTop: spacing.xs,
    color: palette.danger,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  helper: {
    marginTop: spacing.xs,
    color: palette.textMuted,
    fontSize: 12,
  },
});
