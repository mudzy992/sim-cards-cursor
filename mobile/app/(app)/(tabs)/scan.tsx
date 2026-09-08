/**
 * ScanScreen — REDIZAJN (Faza 2): kamera je glavna pojava
 * (instrukcije.md §11: "Point camera → scan → continue"; skener vizuelno
 * dominira, minimalno dodatnog UI, trenutna povratna informacija).
 *
 * Logika identicna originalu:
 *  - expo-camera barkod skeniranje + dozvolе
 *  - vibracija + beep (expo-audio) na uspjesan sken
 *  - route params: afterScan (demount/install/inventory), taskId-ovi
 *  - rucni unos samo cifore, validacija praznog
 * Novine:
 *  - full-bleed kamera sa okvirom i success flashom
 *  - historija zadnja 3 skena (tap na chip ponavlja akciju)
 *  - rucni unos u podignutom panelu ispod kamere
 */
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAudioPlayer } from 'expo-audio';
import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAwareScreen } from '@/components/common/KeyboardAwareScreen';
import { APP_ASSETS } from '@/constants/assets';
import { palette, radii, spacing, type } from '@/theme/tokens';
import { ActionButton } from '@/components/ui/ActionButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';

export default function ScanScreen() {
  const router = useRouter();
  const routeParams = useLocalSearchParams<{
    afterScan?: string | string[];
    demountTaskId?: string | string[];
    installTaskId?: string | string[];
  }>();
  const afterScan = typeof routeParams.afterScan === 'string' ? routeParams.afterScan : routeParams.afterScan?.[0];
  const demountTaskId = typeof routeParams.demountTaskId === 'string' ? routeParams.demountTaskId : routeParams.demountTaskId?.[0];
  const installTaskId = typeof routeParams.installTaskId === 'string' ? routeParams.installTaskId : routeParams.installTaskId?.[0];

  const [permission, requestPermission] = useCameraPermissions();
  const [manualIccid, setManualIccid] = useState('');
  const [scanError, setScanError] = useState<string | null>(null);
  const [hasScanned, setHasScanned] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const beepPlayer = useAudioPlayer(APP_ASSETS.scanBeep);
  const flash = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      setHasScanned(false);
      setScanError(null);
    }, []),
  );

  const playFeedback = useCallback(() => {
    Vibration.vibrate(50);
    try {
      beepPlayer.seekTo(0);
      void beepPlayer.play();
    } catch {
      // fallback samo na vibraciju
    }
    flash.setValue(1);
    Animated.timing(flash, { toValue: 0, duration: 450, useNativeDriver: true }).start();
  }, [beepPlayer, flash]);

  const openResult = useCallback(
    (rawIccid: string) => {
      const iccid = rawIccid.trim();
      if (!iccid) {
        setScanError('Nevažeći ICCID.');
        return;
      }
      setHasScanned(true);
      setHistory((prev) => [iccid, ...prev.filter((x) => x !== iccid)].slice(0, 3));
      if (afterScan === 'demount' && demountTaskId) {
        router.replace({
          pathname: '/(app)/(tabs)/demount',
          params: { pickedIccid: iccid, wizardTaskId: demountTaskId },
        });
        return;
      }
      if (afterScan === 'install' && installTaskId) {
        router.replace({
          pathname: '/(app)/(tabs)/install',
          params: { pickedIccid: iccid, wizardTaskId: installTaskId },
        });
        return;
      }
      if (afterScan === 'inventory') {
        router.replace({
          pathname: '/(app)/offline-inventory',
          params: { pickedIccid: iccid },
        });
        return;
      }
      router.push({ pathname: '/(app)/scan-result', params: { iccid } });
    },
    [router, afterScan, demountTaskId, installTaskId],
  );

  const handleBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (hasScanned) return;
      playFeedback();
      openResult(String(data));
    },
    [hasScanned, openResult, playFeedback],
  );

  const hasPermission = permission?.granted === true;

  return (
    <KeyboardAwareScreen style={styles.root}>
      <StatusBar style="light" />

      {/* ------------------------------ kamera ------------------------------ */}
      <View style={styles.cameraArea}>
        {!permission ? (
          <View style={styles.permissionWrap}>
            <Skeleton width={44} height={44} radius={22} style={styles.permissionSpinner} />
            <Text style={styles.permissionText}>Provjeravam dozvole kamere…</Text>
          </View>
        ) : !hasPermission ? (
          <View style={styles.permissionWrap}>
            <EmptyState
              icon="camera-outline"
              title="Pristup kameri nije odobren"
              description="Za skeniranje barkoda sa SIM kartice potrebna je dozvola za kameru."
              actionLabel="Dozvoli kameru"
              actionVariant="primary"
              onAction={() => void requestPermission()}
            />
          </View>
        ) : (
          <>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              onBarcodeScanned={hasScanned ? undefined : handleBarcodeScanned}
              barcodeScannerSettings={{ barcodeTypes: ['code128', 'code39', 'ean13', 'qr'] }}
            />
            {/* success flash */}
            <Animated.View
              pointerEvents="none"
              style={[styles.flash, { opacity: flash }]}
            />

            {/* scan frame */}
            <View pointerEvents="none" style={styles.frameWrap}>
              <View style={styles.frame}>
                <FrameCorner pos="tl" />
                <FrameCorner pos="tr" />
                <FrameCorner pos="bl" />
                <FrameCorner pos="br" />
              </View>
              <Text style={styles.guidance}>
                Poravnajte barkod unutar okvira
              </Text>
            </View>

            {/* rescan */}
            {hasScanned ? (
              <View style={styles.rescanWrap}>
                <Pressable
                  onPress={() => {
                    setHasScanned(false);
                    setScanError(null);
                  }}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.rescanBtn, pressed && styles.pressed]}
                >
                  <Ionicons name="refresh" size={16} color="#FFFFFF" style={styles.rescanIcon} />
                  <Text style={styles.rescanText}>Skeniraj ponovo</Text>
                </Pressable>
              </View>
            ) : null}
          </>
        )}

        {/* historija skenova */}
        {hasPermission && history.length > 0 ? (
          <View style={styles.historyRow}>
            <Text style={styles.historyLabel}>NEDAVNO</Text>
            <View style={styles.historyChips}>
              {history.map((iccid) => (
                <Pressable
                  key={iccid}
                  onPress={() => openResult(iccid)}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
                >
                  <Ionicons name="card-outline" size={12} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.chipText} numberOfLines={1}>
                    {iccid}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </View>

      {/* --------------------------- rucni unos panel --------------------------- */}
      <View style={styles.entryPanel}>
        <Text style={[type.sectionLabel, styles.entryLabel]}>Ručni unos</Text>
        <TextInput
          value={manualIccid}
          onChangeText={(t) => {
            const digitsOnly = t.replace(/\D/g, '');
            setManualIccid(digitsOnly);
            if (scanError) setScanError(null);
          }}
          placeholder="ICCID"
          placeholderTextColor={palette.textMuted}
          autoCapitalize="none"
          keyboardType="number-pad"
          inputMode="numeric"
          returnKeyType="done"
          onSubmitEditing={() => openResult(manualIccid)}
          style={styles.manualInput}
        />
        {scanError ? (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle" size={14} color={palette.danger} />
            <Text style={styles.errorText}>{scanError}</Text>
          </View>
        ) : null}
        <ActionButton
          title="Provjeri ICCID"
          onPress={() => openResult(manualIccid)}
          variant="primary"
          size="lg"
          style={styles.submit}
        />
      </View>
    </KeyboardAwareScreen>
  );
}

/* --------------------------- okvir za skeniranje --------------------------- */

function FrameCorner({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const base = [
    styles.corner,
    pos === 'tl' && styles.cornerTL,
    pos === 'tr' && styles.cornerTR,
    pos === 'bl' && styles.cornerBL,
    pos === 'br' && styles.cornerBR,
  ];
  return <View style={base} />;
}

/* -------------------------------- stilovi -------------------------------- */

const FRAME_SIZE = 240;
const CORNER_LEN = 26;
const CORNER_W = 4;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.graphite },

  cameraArea: {
    flex: 1.15,
    minHeight: 320,
    backgroundColor: '#000000',
  },
  flash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(21, 128, 61, 0.35)',
  },
  frameWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE * 0.62,
  },
  corner: {
    position: 'absolute',
    width: CORNER_LEN,
    height: CORNER_LEN,
    borderColor: '#FFFFFF',
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: CORNER_W, borderLeftWidth: CORNER_W },
  cornerTR: { top: 0, right: 0, borderTopWidth: CORNER_W, borderRightWidth: CORNER_W },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: CORNER_W, borderLeftWidth: CORNER_W },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: CORNER_W, borderRightWidth: CORNER_W },
  guidance: {
    marginTop: spacing.lg,
    color: 'rgba(255,255,255,0.82)',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.2,
  },

  rescanWrap: {
    position: 'absolute',
    bottom: spacing.lg,
    alignSelf: 'center',
  },
  rescanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rescanIcon: { marginRight: spacing.sm },
  rescanText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  pressed: { opacity: 0.75 },

  historyRow: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
  },
  historyLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  historyChips: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    maxWidth: 190,
  },
  chipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'monospace',
    letterSpacing: 0.2,
  },

  entryPanel: {
    backgroundColor: palette.background,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  entryLabel: { marginBottom: spacing.sm },
  manualInput: {
    borderWidth: 1.5,
    borderColor: palette.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: palette.surface,
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
  },
  errorText: { color: palette.danger, fontSize: 13, fontWeight: '600' },
  submit: { marginTop: spacing.lg },

  permissionWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  permissionSpinner: { marginBottom: spacing.lg, opacity: 0.5 },
  permissionText: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
});
