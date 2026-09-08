/** Veliki izbor pogodan za rad na terenu i rukavice. */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, radii, spacing, type } from '@/theme/tokens';

export interface ChoiceRowProps {
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}

export function ChoiceRow({ label, description, selected, onPress, disabled }: ChoiceRowProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => [
        styles.row,
        selected && styles.selected,
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null,
      ]}
    >
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <Ionicons name="checkmark" size={14} color={palette.inverse} /> : null}
      </View>
      <View style={styles.body}>
        <Text style={[type.bodyStrong, selected && styles.selectedText]}>{label}</Text>
        {description ? <Text style={[type.caption, styles.description]}>{description}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.md,
    backgroundColor: palette.surface,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  selected: { borderColor: palette.brand, backgroundColor: palette.brandSoft },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.55 },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: palette.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: palette.brand, backgroundColor: palette.brand },
  body: { flex: 1 },
  selectedText: { color: palette.brandPressed },
  description: { marginTop: 2, lineHeight: 18 },
});