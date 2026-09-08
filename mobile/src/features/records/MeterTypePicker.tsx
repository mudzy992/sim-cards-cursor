import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { MeterTypeDefinitionItem } from '@/api/meter-type-definitions.api';
import { palette, radii, spacing, type } from '@/theme/tokens';

export function MeterTypePicker({
  label = 'Tip brojila',
  items,
  value,
  onChange,
  loading,
  error,
}: {
  label?: string;
  items: MeterTypeDefinitionItem[];
  value: string;
  onChange: (id: string) => void;
  loading?: boolean;
  error?: boolean;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={type.sectionLabel}>{label} *</Text>
      {loading ? <ActivityIndicator color={palette.brand} style={styles.loader} /> : error ? (
        <Text style={styles.error}>Nije moguće učitati tipove brojila. Provjerite mrežu.</Text>
      ) : !items.length ? (
        <Text style={styles.empty}>Nema definisanih tipova brojila.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {items.map((item) => {
            const selected = item.id === value;
            return (
              <Pressable
                key={item.id}
                onPress={() => onChange(item.id)}
                style={({ pressed }) => [styles.item, selected && styles.selected, pressed && styles.pressed]}
              >
                <Text style={[styles.label, selected && styles.selectedLabel]}>{item.name}</Text>
                {item.manufacturer || item.model ? (
                  <Text style={[styles.meta, selected && styles.selectedMeta]} numberOfLines={1}>
                    {[item.manufacturer, item.model].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  loader: { marginVertical: spacing.xl },
  row: { gap: spacing.sm, paddingTop: spacing.sm, paddingRight: spacing.xl },
  item: {
    minWidth: 132,
    maxWidth: 210,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.md,
    backgroundColor: palette.surface,
    padding: spacing.md,
  },
  selected: { borderColor: palette.brand, backgroundColor: palette.brandSoft },
  pressed: { opacity: 0.72 },
  label: { color: palette.textPrimary, fontSize: 14, fontWeight: '600' },
  selectedLabel: { color: palette.brandPressed },
  meta: { marginTop: 3, color: palette.textMuted, fontSize: 11 },
  selectedMeta: { color: palette.brand },
  error: { marginTop: spacing.sm, color: palette.danger, fontSize: 13 },
  empty: { marginTop: spacing.sm, color: palette.textMuted, fontSize: 13 },
});