import { ActivityIndicator, StyleSheet, Switch, Text, View } from 'react-native';
import type { MeterTypeFieldItem } from '@/api/meter-type-definitions.api';
import { palette, spacing, type } from '@/theme/tokens';
import { Field } from '@/components/ui/Field';

export function DynamicMeterFields({
  fields,
  values,
  onChange,
  loading,
  error,
}: {
  fields: MeterTypeFieldItem[];
  values: Record<string, unknown>;
  onChange: (fieldName: string, value: unknown) => void;
  loading?: boolean;
  error?: boolean;
}) {
  if (loading) return <ActivityIndicator color={palette.brand} style={styles.loader} />;
  if (error) return <Text style={styles.error}>Nije moguće učitati dodatna polja za ovaj tip brojila.</Text>;

  const sorted = fields.slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  if (!sorted.length) return null;

  return (
    <View style={styles.wrap}>
      <Text style={[type.sectionLabel, styles.heading]}>Dodatna polja brojila</Text>
      {sorted.map((field) => {
        const raw = values[field.name];
        if (!field.isOperatorFillable) {
          return (
            <View key={field.id} style={styles.readonlyRow}>
              <Text style={styles.readonlyLabel}>{field.label}</Text>
              <Text style={styles.readonlyValue}>{field.defaultValue ?? '—'}</Text>
            </View>
          );
        }
        if (field.fieldType === 'BOOLEAN') {
          const checked = raw === true || raw === 'true' || raw === 1 || raw === '1';
          return (
            <View key={field.id} style={styles.switchRow}>
              <Text style={type.bodyStrong}>{field.label}{field.isRequired ? ' *' : ''}</Text>
              <Switch
                value={checked}
                onValueChange={(value) => onChange(field.name, value)}
                trackColor={{ false: palette.borderStrong, true: palette.brandSoftStrong }}
                thumbColor={checked ? palette.brand : palette.surface}
              />
            </View>
          );
        }
        const text = raw == null ? '' : String(raw);
        return (
          <Field
            key={field.id}
            label={field.label}
            required={field.isRequired}
            value={text}
            placeholder={field.fieldType === 'DATE' ? 'YYYY-MM-DD' : field.isRequired ? 'Obavezno' : 'Opcionalno'}
            keyboardType={field.fieldType === 'NUMBER' ? 'decimal-pad' : 'default'}
            onChangeText={(value) => {
              if (field.fieldType === 'NUMBER') {
                const normalized = value.replace(',', '.');
                const number = normalized.length ? Number(normalized) : undefined;
                onChange(
                  field.name,
                  typeof number === 'number' && Number.isFinite(number) ? number : value,
                );
                return;
              }
              onChange(field.name, value);
            }}
          />
        );
      })}
    </View>
  );
}

export function validateRequiredDynamicFields(fields: MeterTypeFieldItem[], values: Record<string, unknown>): string[] {
  return fields
    .filter((field) => field.isOperatorFillable && field.isRequired)
    .filter((field) => {
      const value = values[field.name];
      return value == null || (typeof value === 'string' && value.trim().length === 0);
    })
    .map((field) => field.label);
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.sm },
  heading: { marginBottom: spacing.md },
  loader: { marginVertical: spacing.xl },
  error: { color: palette.danger, fontSize: 13, marginBottom: spacing.lg },
  readonlyRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.md },
  readonlyLabel: { color: palette.textSecondary, fontSize: 13 },
  readonlyValue: { color: palette.textPrimary, fontSize: 13, fontWeight: '600' },
  switchRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
});