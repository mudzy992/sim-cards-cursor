import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '@/i18n/i18n.store';
import {
  radii,
  spacing,
  useTheme,
  useThemedStyles,
  type ThemePalette,
} from '@/theme/tokens';
import { StatusBadge, type StatusTone } from '@/components/ui/StatusBadge';
import { ActionButton } from '@/components/ui/ActionButton';
import { formatDistance } from '@/utils/geo';

export type OperationalTaskStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

const statusToneMap: Record<OperationalTaskStatus, StatusTone> = {
  PENDING: 'warning',
  IN_PROGRESS: 'info',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
};

const statusKeyMap: Record<OperationalTaskStatus, string> = {
  PENDING: 'mobile.tasks.statusPending',
  IN_PROGRESS: 'mobile.tasks.statusInProgress',
  COMPLETED: 'mobile.tasks.statusCompleted',
  CANCELLED: 'mobile.tasks.statusCancelled',
};

function getSlaBadge(
  status: OperationalTaskStatus,
  createdAt: string | undefined,
  t: (key: string, params?: Record<string, string | number>) => string,
): { label: string; tone: 'warning' | 'danger' } | null {
  if (!createdAt || status === 'COMPLETED' || status === 'CANCELLED') {
    return null;
  }
  const ageHours = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  if (!Number.isFinite(ageHours) || ageHours < 48) return null;
  const days = Math.floor(ageHours / 24);
  if (ageHours >= 120) {
    return { label: t('mobile.tasks.slaUrgent', { days }), tone: 'danger' };
  }
  return { label: t('mobile.tasks.slaWarning', { days }), tone: 'warning' };
}

export interface TaskCardProps {
  testID?: string;
  title: string;
  status: OperationalTaskStatus;
  createdAt?: string;
  createdBy?: string | null;
  note?: string | null;
  metadata?: Array<{ label: string; value: string }>;
  pendingOffline?: boolean;
  updating?: boolean;
  distanceMeters?: number | null;
  onNavigate?: () => void;
  primaryLabel?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}

export function TaskCard(props: TaskCardProps) {
  const { palette, type } = useTheme();
  const { t, language } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const statusTone = statusToneMap[props.status];
  const statusLabel = t(statusKeyMap[props.status]);
  const sla = getSlaBadge(props.status, props.createdAt, t);
  const locale = language === 'en' ? 'en-GB' : 'bs-BA';

  return (
    <View style={styles.card} testID={props.testID}>
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <Text style={type.dataLarge} numberOfLines={1}>
            {props.title}
          </Text>
          {props.createdAt ? (
            <Text style={[type.caption, styles.created]} numberOfLines={1}>
              {new Date(props.createdAt).toLocaleString(locale)}
              {props.createdBy ? ` · ${props.createdBy}` : ''}
            </Text>
          ) : null}
        </View>
        <View style={styles.badgesCol}>
          <StatusBadge
            tone={statusTone}
            label={statusLabel}
            showDot={props.status === 'IN_PROGRESS'}
          />
          {sla ? <StatusBadge tone={sla.tone} label={sla.label} /> : null}
        </View>
      </View>

      {props.distanceMeters != null || props.onNavigate ? (
        <View style={styles.geoBar}>
          {props.distanceMeters != null ? (
            <View style={styles.distanceChip} testID="task-distance-chip">
              <Ionicons
                name="navigate-outline"
                size={14}
                color={palette.info}
              />
              <Text style={styles.distanceText}>
                {formatDistance(props.distanceMeters)}
              </Text>
            </View>
          ) : null}
          {props.onNavigate ? (
            <Pressable
              testID="task-navigate-btn"
              onPress={props.onNavigate}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.mapButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name="map-outline"
                size={14}
                color={palette.brandText}
              />
              <Text style={styles.mapButtonText}>
                {t('mobile.tasks.navigate')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {props.pendingOffline ? (
        <View style={styles.offlineRow} testID="task-pending-offline">
          <Ionicons
            name="cloud-offline-outline"
            size={14}
            color={palette.warning}
          />
          <Text style={styles.offlineText}>
            {t('mobile.tasks.pendingSync')}
          </Text>
        </View>
      ) : null}

      {props.metadata?.length ? (
        <View style={styles.metadata}>
          {props.metadata.map((item, index) => (
            <View
              key={`${item.label}-${index}`}
              style={[styles.metaRow, index > 0 && styles.metaDivider]}
            >
              <Text style={styles.metaLabel}>{item.label}</Text>
              <Text style={styles.metaValue} numberOfLines={2}>
                {item.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {props.note ? (
        <View style={styles.note}>
          <Text style={styles.noteLabel}>{t('mobile.tasks.noteLabel')}</Text>
          <Text style={styles.noteText}>{props.note}</Text>
        </View>
      ) : null}

      {props.primaryLabel || props.secondaryLabel ? (
        <View style={styles.actions}>
          {props.secondaryLabel && props.onSecondary ? (
            <ActionButton
              testID="task-secondary-btn"
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
              testID="task-primary-btn"
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
          {props.updating && !props.primaryLabel ? (
            <ActivityIndicator color={palette.brandText} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (palette: ThemePalette) => ({
  card: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.lg,
    backgroundColor: palette.surface,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: spacing.md,
  },
  titleWrap: { flex: 1, minWidth: 0 },
  created: { marginTop: 3 },
  badgesCol: { alignItems: 'flex-end' as const, gap: spacing.xs },
  geoBar: {
    marginTop: spacing.md,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    flexWrap: 'wrap' as const,
  },
  distanceChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
    backgroundColor: palette.infoSoft,
    borderWidth: 1,
    borderColor: palette.infoBorder,
  },
  distanceText: {
    color: palette.info,
    fontSize: 12,
    fontWeight: '700' as const,
    fontFamily: 'monospace' as const,
  },
  mapButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radii.sm,
    backgroundColor: palette.brandSoft,
    borderWidth: 1,
    borderColor: palette.borderStrong,
  },
  mapButtonText: {
    color: palette.brandText,
    fontSize: 12,
    fontWeight: '700' as const,
  },
  pressed: { opacity: 0.7 },
  offlineRow: {
    marginTop: spacing.md,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: palette.warningSoft,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  offlineText: { color: palette.warning, fontSize: 12, fontWeight: '600' as const },
  metadata: {
    marginTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  metaRow: {
    flexDirection: 'row' as const,
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  metaDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  metaLabel: {
    width: 90,
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  metaValue: {
    flex: 1,
    color: palette.textPrimary,
    fontSize: 13,
    fontWeight: '600' as const,
    fontFamily: 'monospace' as const,
  },
  note: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: palette.surfaceSunken,
    borderRadius: radii.sm,
  },
  noteLabel: {
    color: palette.textMuted,
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 0.8,
  },
  noteText: {
    marginTop: 3,
    color: palette.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    marginTop: spacing.lg,
    flexDirection: 'row' as const,
    justifyContent: 'flex-end' as const,
    gap: spacing.sm,
  },
  action: { minWidth: 100 },
  actionPrimary: { minWidth: 112 },
});
