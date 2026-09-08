/**
 * WorkflowSteps — vertikalni guided-procedure indikator
 * (instrukcije.md §13: instalacija/demontaza kao vodeni postupak).
 *
 * Korisnik uvijek zna: gdje je, sta je zavrseno, sta slijedi, sta nedostaje.
 * Namijenjen kao zajednicki gradivni blok za install/demount steppere
 * (Faza 3 unificija velikih ekrana).
 */
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, radii, spacing, type } from '@/theme/tokens';

export type WorkflowStepState = 'done' | 'current' | 'pending' | 'error';

export interface WorkflowStep {
  key: string;
  label: string;
  state: WorkflowStepState;
  /** kratak opis ili podatak koraka (npr. ICCID) — monospace prikaz */
  detail?: string;
}

export interface WorkflowStepsProps {
  steps: WorkflowStep[];
  /** opcioni naslov bloka, npr. "UGRADNJA — korak 2 od 4" */
  header?: string;
}

export function WorkflowSteps({ steps, header }: WorkflowStepsProps) {
  return (
    <View>
      {header ? <Text style={[type.sectionLabel, styles.header]}>{header}</Text> : null}
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
                <Text style={[type.caption, styles.detail]}>Ceka…</Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function StepMarker({ state, index }: { state: WorkflowStepState; index: number }) {
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

const styles = StyleSheet.create({
  header: { marginBottom: spacing.md },
  stepRow: { flexDirection: 'row', minHeight: 52 },
  rail: { width: 32, alignItems: 'center' },
  marker: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerDone: { backgroundColor: palette.success },
  markerCurrent: { backgroundColor: palette.brand },
  markerError: { backgroundColor: palette.danger },
  markerPending: {
    backgroundColor: palette.surfaceMuted,
    borderWidth: 1.5,
    borderColor: palette.borderStrong,
  },
  markerCurrentText: { color: palette.inverse, fontWeight: '700', fontSize: 13 },
  markerPendingText: { color: palette.textMuted, fontWeight: '600', fontSize: 13 },
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
