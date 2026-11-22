import { StyleSheet } from 'react-native';
import { useTranslation } from '@/i18n/i18n.store';
import { spacing } from '@/theme/tokens';
import { SegmentedFilter, type SegmentOption } from '@/components/ui/SegmentedFilter';
import type { OperationalTaskStatus } from './TaskCard';

export type TaskFilter = 'ACTIVE' | 'COMPLETED' | 'ALL';

export function taskMatchesFilter(
  status: OperationalTaskStatus,
  filter: TaskFilter,
): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'ACTIVE') return status === 'PENDING' || status === 'IN_PROGRESS';
  return status === 'COMPLETED';
}

export function TaskFilterBar({
  value,
  onChange,
  counts,
  testID,
}: {
  value: TaskFilter;
  onChange: (value: TaskFilter) => void;
  counts?: { active?: number; completed?: number; all?: number };
  testID?: string;
}) {
  const { t } = useTranslation();
  const options: Array<SegmentOption<TaskFilter>> = [
    { key: 'ACTIVE', label: t('mobile.tasks.filterActive'), count: counts?.active },
    { key: 'COMPLETED', label: t('mobile.tasks.filterCompleted') },
    { key: 'ALL', label: t('mobile.tasks.filterAll') },
  ];
  return (
    <SegmentedFilter
      testID={testID ?? 'task-filter-bar'}
      options={options}
      value={value}
      onChange={onChange}
      style={styles.bar}
    />
  );
}

const styles = StyleSheet.create({
  bar: { marginHorizontal: spacing.xl, marginBottom: spacing.md },
});
