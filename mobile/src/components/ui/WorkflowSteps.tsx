import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  spacing,
  useTheme,
  useThemedStyles,
  type ThemePalette,
} from '@/theme/tokens';

export type WorkflowStepState = 'done' | 'current' | 'pending' | 'error';

export interface WorkflowStep {
  key: string;
  label: string;
  state: WorkflowStepState;
  detail?: string;
}

export interface WorkflowStepsProps {
  steps: WorkflowStep[];
  header?: string;
}

export function WorkflowSteps({ steps, header }: WorkflowStepsProps) {
  const { type } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View>
      {header ? (
        <Text style={[type.sectionLabel, styles.header]}>{header}</Text>
      ) : null}
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        return (
          <View key={step.key} style={styles.stepRow}>
            <View style={styles.rail}>
              <StepMarker state={step.state} index={index} />
              {!isLast ? (
                <View
                  style={[
                    styles.connector,
                    step.state === 'done' ? styles.connectorDone : null,
                  ]}
                />
              ) : null}
            </View>
            <View style={styles.stepBody}>
              <Text
                style={[
                  type.bodyStrong,
                  step.state === 'pending' ? styles.pendingText : null,
                  step.state === 'error' ? styles.errorText : null,
                ]}
                numberOfLines={1}
              >
                {step.label}
              </Text>
              {step.detail ? (
                <Text style={[type.dataSmall, styles.detail]} numberOfLines={1}>
                  {step.detail}
                </Text>
              ) : step.state === 'pending' ? (
                <Text style={[type.caption, styles.detail]}>Čeka…</Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function StepMarker({
  state,
  index,
}: {
  state: WorkflowStepState;
  index: number;
}) {
  const { palette } = useTheme();
  const styles = useThemedStyles(createStyles);

  switch (state) {
    case 'done':
      return (
        <View style={[styles.marker, styles.markerDone]}>
          <Ionicons name="checkmark" size={16} color={palette.inverse} />
        </View>
      );
    case 'current':
      return (
        <View style={[styles.marker, styles.markerCurrent]}>
          <Text style={styles.markerCurrentText}>{index + 1}</Text>
        </View>
      );
    case 'error':
      return (
        <View style={[styles.marker, styles.markerError]}>
          <Ionicons name="close" size={16} color={palette.inverse} />
        </View>
      );
    default:
      return (
        <View style={[styles.marker, styles.markerPending]}>
          <Text style={styles.markerPendingText}>{index + 1}</Text>
        </View>
      );
  }
}

const createStyles = (palette: ThemePalette) => ({
  header: { marginBottom: spacing.md },
  stepRow: { flexDirection: 'row' as const, minHeight: 52 },
  rail: { width: 32, alignItems: 'center' as const },
  marker: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  markerDone: { backgroundColor: palette.successBorder },
  markerCurrent: { backgroundColor: palette.brand },
  markerError: { backgroundColor: palette.dangerSolid },
  markerPending: {
    backgroundColor: palette.surfaceMuted,
    borderWidth: 1.5,
    borderColor: palette.borderStrong,
  },
  markerCurrentText: {
    color: palette.inverse,
    fontWeight: '700' as const,
    fontSize: 13,
  },
  markerPendingText: {
    color: palette.textMuted,
    fontWeight: '600' as const,
    fontSize: 13,
  },
  connector: {
    flex: 1,
    width: 2,
    backgroundColor: palette.border,
    marginVertical: 2,
  },
  connectorDone: { backgroundColor: palette.successBorder },
  stepBody: { flex: 1, paddingBottom: spacing.lg, paddingLeft: spacing.md },
  pendingText: { color: palette.textMuted },
  errorText: { color: palette.danger },
  detail: { marginTop: 2 },
});
