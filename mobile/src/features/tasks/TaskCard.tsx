/** Zajednicki prikaz instalacijskog/demontaznog zadatka. */
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, radii, spacing, type } from '@/theme/tokens';
import { StatusBadge, type StatusTone } from '@/components/ui/StatusBadge';
import { ActionButton } from '@/components/ui/ActionButton';

export type OperationalTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

const statusMeta: Record<OperationalTaskStatus, { label: string; tone: StatusTone }> = {
  PENDING: { label: 'Čeka', tone: 'warning' },
  IN_PROGRESS: { label: 'U toku', tone: 'info' },
  COMPLETED: { label: 'Završeno', tone: 'success' },
  CANCELLED: { label: 'Otkazano', tone: 'neutral' },
};

export interface TaskCardProps {
  title: string;
  status: OperationalTaskStatus;
  createdAt?: string;
  createdBy?: string | null;
  note?: string | null;
  metadata?: Array<{ label: string; value: string }>;
  pendingOffline?: boolean;
  updating?: boolean;
  primaryLabel?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}

export function TaskCard(props: TaskCardProps) {
  const meta = statusMeta[props.status];
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <Text style={type.dataLarge} numberOfLines={1}>{props.title}</Text>
          {props.createdAt ? (
            <Text style={[type.caption, styles.created]} numberOfLines={1}>
              {new Date(props.createdAt).toLocaleString('bs-BA')}
              {props.createdBy ? ` · ${props.createdBy}` : ''}
            </Text>
          ) : null}
        </View>
        <StatusBadge tone={meta.tone} label={meta.label} showDot={props.status === 'IN_PROGRESS'} />
      </View>

      {props.pendingOffline ? (
        <View style={styles.offlineRow}>
          <Ionicons name="cloud-offline-outline" size={14} color={palette.warning} />
          <Text style={styles.offlineText}>Promjena čeka slanje</Text>
        </View>
      ) : null}

      {props.metadata?.length ? (
        <View style={styles.metadata}>
          {props.metadata.map((item, index) => (
            <View key={`${item.label}-${index}`} style={[styles.metaRow, index > 0 && styles.metaDivider]}>
              <Text style={styles.metaLabel}>{item.label}</Text>
              <Text style={styles.metaValue} numberOfLines={2}>{item.value}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {props.note ? (
        <View style={styles.note}>
          <Text style={styles.noteLabel}>NAPOMENA</Text>
          <Text style={styles.noteText}>{props.note}</Text>
        </View>
      ) : null}

      {props.primaryLabel || props.secondaryLabel ? (
        <View style={styles.actions}>
          {props.secondaryLabel && props.onSecondary ? (
            <ActionButton
              title={props.secondaryLabel}
              onPress={props.onSecondary}
              variant="secondary"
              size="sm"
              fullWidth={false}
              disabled={props.updating}
              style={styles.action}
            />
          ) : null}
          {props.primaryLabel && props.onPrimary ? (
            <ActionButton
              title={props.primaryLabel}
              onPress={props.onPrimary}
              variant="primary"
              size="sm"
              fullWidth={false}
              disabled={props.updating}
              loading={props.updating}
              style={styles.actionPrimary}
            />
          ) : null}
          {props.updating && !props.primaryLabel ? <ActivityIndicator color={palette.brand} /> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.lg,
    backgroundColor: palette.surface,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  titleWrap: { flex: 1, minWidth: 0 },
  created: { marginTop: 3 },
  offlineRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.warningSoft,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  offlineText: { color: palette.warning, fontSize: 12, fontWeight: '600' },
  metadata: { marginTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border },
  metaRow: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.sm },
  metaDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border },
  metaLabel: { width: 90, color: palette.textMuted, fontSize: 12, fontWeight: '600' },
  metaValue: { flex: 1, color: palette.textPrimary, fontSize: 13, fontWeight: '600', fontFamily: 'monospace' },
  note: { marginTop: spacing.md, padding: spacing.md, backgroundColor: palette.surfaceMuted, borderRadius: radii.sm },
  noteLabel: { color: palette.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  noteText: { marginTop: 3, color: palette.textSecondary, fontSize: 13, lineHeight: 18 },
  actions: { marginTop: spacing.lg, flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
  action: { minWidth: 100 },
  actionPrimary: { minWidth: 112 },
});