/** Standardno polje: labela, obavezna oznaka, input i inline greška. */
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { palette, radii, spacing, type } from '@/theme/tokens';

export interface FieldProps extends TextInputProps {
  label: string;
  required?: boolean;
  error?: string | null;
}

export function Field({ label, required, error, style, multiline, ...inputProps }: FieldProps) {
  return (
    <View style={styles.wrap}>
      <Text style={type.sectionLabel}>
        {label}{required ? ' *' : ''}
      </Text>
      <TextInput
        {...inputProps}
        multiline={multiline}
        placeholderTextColor={palette.textMuted}
        style={[
          styles.input,
          multiline && styles.multiline,
          error ? styles.inputError : null,
          style,
        ]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  input: {
    marginTop: spacing.sm,
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
  multiline: { minHeight: 92, textAlignVertical: 'top' },
  inputError: { borderColor: palette.danger },
  error: { marginTop: spacing.xs, color: palette.danger, fontSize: 12, fontWeight: '600' },
});