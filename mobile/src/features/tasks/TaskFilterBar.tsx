/**
 * TaskFilterBar — filter zadataka za Ugradnju i Demontazu.
 * Reducirano na 3 smislena stanja (ranije 5 razvucenih chipova):
 *  Aktivni = PENDING + IN_PROGRESS, Zavrseni = COMPLETED, Svi = sve ukljucujuci
 *  otkazane. Detaljan status svakog zadatka ostaje vidljiv na kartici.
 */
import { StyleSheet } from 'react-native';
import { spacing } from '@/theme/tokens';
import { SegmentedFilter, type SegmentOption } from '@/components/ui/SegmentedFilter';
import type { OperationalTaskStatus } from './TaskCard';

export type TaskFilter = 'ACTIVE' | 'COMPLETED' | 'ALL';

export function taskMatchesFilter(status: OperationalTaskStatus, filter: TaskFilter): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'ACTIVE') return status === 'PENDING' || status === 'IN_PROGRESS';
  return status === 'COMPLETED';
}

export function TaskFilterBar({
  value,
  onChange,
  counts,
}: {
  value: TaskFilter;
  onChange: (value: TaskFilter) => void;
  /** brojaci se prikazuju uz labelu; korisno za "Aktivni" */
  counts?: { active?: number; completed?: number; all?: number };
}) {
  const options: Array<SegmentOption<TaskFilter>> = [
    { key: 'ACTIVE', label: 'Aktivni', count: counts?.active },
    { key: 'COMPLETED', label: 'Završeni' },
    { key: 'ALL', label: 'Svi' },
  ];
  return <SegmentedFilter options={options} value={value} onChange={onChange} style={styles.bar} />;
}

const styles = StyleSheet.create({
  bar: { marginHorizontal: spacing.xl, marginBottom: spacing.md },
});
