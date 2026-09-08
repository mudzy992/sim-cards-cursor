/**
 * ScanScreen — REDIZAJN (camera-first).
 *
 * Izmjene u odnosu na prethodnu verziju:
 *  1) Kamera je full-bleed preko cijelog ekrana; nema stalnog panela ispod
 *     koji joj je ranije oduzimao ~40% prostora.
 *  2) Rucni unos se otvara kao bottom sheet (dugme u donjoj traci), pa ne
 *     zauzima prostor dok se skenira.
 *  3) Dodano svjetlo (torch) — rad u mracnim ormaricima i podrumima.
 *  4) Animirana linija skeniranja + success flash + haptika/zvuk.
 *  5) Historija zadnja 3 skena kao kompaktni cipovi.
 *
 * Logika je NEPROMIJENJENA: expo-camera dozvole, barcode handler, ruta
 * afterScan (demount/install/inventory), beep + vibracija, validacija unosa.
 */
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAudioPlayer } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { APP_ASSETS } from '@/constants/assets';
import { palette, radii, spacing } from '@/theme/tokens';
import { ActionButton } from '@/components/ui/ActionButton';

const { width: SCREEN_W } = Dimensions.get('window');
const FRAME_W = Math.min(SCREEN_W * 0.78, 320);
const FRAME_H = Math.round(FRAME_W / 2.1);

export default function ScanScreen() {
  const router = useRouter();
  const routeParams = useLocalSearchParams<{
    afterScan?: string | string[];
    demountTaskId?: string | string[];
    installTaskId?: string | string[];
  }>();
  const afterScan =
    typeof routeParams.afterScan === 'string' ? routeParams.afterScan : routeParams.afterScan?.[0];
  const demountTaskId =
    typeof routeParams.demountTaskId === 'string'
      ? routeParams.demountTaskId
      : routeParams.demountTaskId?.[0];
  const installTaskId =
    typeof routeParams.installTaskId === 'string'
      ? routeParams.installTaskId
      : routeParams.installTaskId?.[0];

  const [permission, requestPermission] = useCameraPermissions();
  const [manualIccid, setManualIccid] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [hasScanned, setHasScanned] = useState(false);
  const [torch, setTorch] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const beepPlayer = useAudioPlayer(APP_ASSETS.scanBeep);

  const flash = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      setHasScanned(false);
      setScanError(null);
      return () => setTorch(false);
    }, []),
  );

  /* animirana linija skeniranja — pauzira se nakon uspjesnog skena */
  useEffect(() => {
    if (hasScanned) {
      sweep.stopAnimation();
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, {
          toValue: 1,
          duration: 1900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(sweep, {
          toValue: 0,
          duration: 1900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [hasScanned, sweep]);

  const playFeedback = useCallback(() => {
    Vibration.vibrate(50);
    try {
      beepPlayer.seekTo(0);
      void beepPlayer.play();
    } catch {
      // fallback samo na vibraciju
    }
    flash.setValue(1);
    Animated.timing(flash, { toValue: 0, duration: 420, useNativeDriver: true }).start();
  }, [beepPlayer, flash]);

  const openResult = useCallback(
    (rawIccid: string) => {
      const iccid = rawIccid.trim();
      if (!iccid) {
        setScanError('Unesite ispravan ICCID.');
        return;
      }
      setHasScanned(true);
      setManualOpen(false);
      setTorch(false);
      setHistory((prev) => [iccid, ...prev.filter((value) => value !== iccid)].slice(0, 3));

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
        router.replace({ pathname: '/(app)/offline-inventory', params: { pickedIccid: iccid } });
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
  const contextLabel =
    afterScan === 'install'
      ? 'Skeniranje za ugradnju'
      : afterScan === 'demount'
        ? 'Skeniranje zamjenske kartice'
        : afterScan === 'inventory'
          ? 'Dodavanje u offline inventar'
          : 'Skeniranje SIM kartice';

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {hasPermission ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          onBarcodeScanned={hasScanned ? undefined : handleBarcodeScanned}
          barcodeScannerSettings={{ barcodeTypes: ['code128', 'code39', 'ean13', 'qr'] }}
        />
      ) : null}

      {/* success flash */}
      <Animated.View pointerEvents="none" style={[styles.flash, { opacity: flash }]} />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* ------------------------------ header ------------------------------ */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{contextLabel}</Text>
            <Text style={styles.subtitle}>Poravnajte barkod unutar okvira</Text>
          </View>
          {hasPermission ? (
            <Pressable
              onPress={() => setTorch((value) => !value)}
              accessibilityRole="button"
              accessibilityLabel={torch ? 'Ugasi svjetlo' : 'Upali svjetlo'}
              style={({ pressed }) => [
                styles.torch,
                torch && styles.torchOn,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name={torch ? 'flashlight' : 'flashlight-outline'}
                size={20}
                color={torch ? palette.graphite : '#FFFFFF'}
              />
            </Pressable>
          ) : null}
        </View>

        {/* ------------------------------- centar ------------------------------ */}
        <View style={styles.center}>
          {!permission ? (
            <Text style={styles.infoText}>Provjeravam dozvole kamere…</Text>
          ) : !hasPermission ? (
            <View style={styles.permissionCard}>
              <View style={styles.permissionIcon}>
                <Ionicons name="camera-outline" size={26} color="#FFFFFF" />
              </View>
              <Text style={styles.permissionTitle}>Pristup kameri nije odobren</Text>
              <Text style={styles.permissionText}>
                Za skeniranje barkoda sa SIM kartice potrebna je dozvola za kameru.
              </Text>
              <ActionButton
                title="Dozvoli kameru"
                icon="checkmark"
                onPress={() => void requestPermission()}
                style={styles.permissionAction}
              />
            </View>
          ) : (
            <View style={styles.frame} pointerEvents="none">
              <FrameCorner position="tl" />
              <FrameCorner position="tr" />
              <FrameCorner position="bl" />
              <FrameCorner position="br" />
              {!hasScanned ? (
                <Animated.View
                  style={[
                    styles.sweep,
                    {
                      transform: [
                        {
                          translateY: sweep.interpolate({
                            inputRange: [0, 1],
                            outputRange: [6, FRAME_H - 6],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              ) : (
                <View style={styles.scannedBadge}>
                  <Ionicons name="checkmark-circle" size={18} color={palette.success} />
                  <Text style={styles.scannedText}>Očitano</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* ------------------------------- footer ------------------------------ */}
        <View style={styles.footer}>
          {history.length > 0 ? (
            <View style={styles.historyRow}>
              {history.map((iccid) => (
                <Pressable
                  key={iccid}
                  onPress={() => openResult(iccid)}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
                >
                  <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.75)" />
                  <Text style={styles.chipText} numberOfLines={1}>
                    {iccid.length > 12 ? `…${iccid.slice(-10)}` : iccid}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={styles.footerActions}>
            <Pressable
              onPress={() => {
                setManualIccid('');
                setScanError(null);
                setManualOpen(true);
              }}
              accessibilityRole="button"
              style={({ pressed }) => [styles.footerButton, pressed && styles.pressed]}
            >
              <Ionicons name="keypad-outline" size={18} color="#FFFFFF" />
              <Text style={styles.footerButtonText}>Ručni unos</Text>
            </Pressable>

            {hasScanned ? (
              <Pressable
                onPress={() => {
                  setHasScanned(false);
                  setScanError(null);
                }}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.footerButton,
                  styles.footerButtonPrimary,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name="refresh" size={18} color="#FFFFFF" />
                <Text style={styles.footerButtonText}>Skeniraj ponovo</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </SafeAreaView>

      {/* --------------------------- ručni unos sheet --------------------------- */}
      <Modal
        visible={manualOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setManualOpen(false)}
      >
        <Pressable style={styles.sheetScrim} onPress={() => setManualOpen(false)} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Ručni unos ICCID-a</Text>
            <Text style={styles.sheetHint}>
              Koristite kada je barkod oštećen ili nečitljiv.
            </Text>
            <TextInput
              value={manualIccid}
              onChangeText={(text) => {
                setManualIccid(text.replace(/\D/g, ''));
                if (scanError) setScanError(null);
              }}
              placeholder="npr. 89387012345678901234"
              placeholderTextColor={palette.textMuted}
              keyboardType="number-pad"
              inputMode="numeric"
              returnKeyType="done"
              autoFocus
              onSubmitEditing={() => openResult(manualIccid)}
              style={styles.sheetInput}
            />
            {scanError ? <Text style={styles.sheetError}>{scanError}</Text> : null}
            <ActionButton
              title="Provjeri ICCID"
              icon="search"
              size="lg"
              disabled={manualIccid.trim().length === 0}
              onPress={() => openResult(manualIccid)}
              style={styles.sheetAction}
            />
            <ActionButton
              title="Odustani"
              variant="ghost"
              onPress={() => setManualOpen(false)}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function FrameCorner({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
  return (
    <View
      style={[
        styles.corner,
        position === 'tl' && styles.cornerTL,
        position === 'tr' && styles.cornerTR,
        position === 'bl' && styles.cornerBL,
        position === 'br' && styles.cornerBR,
      ]}
    />
  );
}

const CORNER = 28;
const CORNER_W = 3.5;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  safe: { flex: 1, justifyContent: 'space-between' },
  flash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(21, 128, 61, 0.35)',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  headerText: { flex: 1, minWidth: 0 },
  title: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  subtitle: { color: 'rgba(255,255,255,0.62)', fontSize: 12.5, marginTop: 2 },
  torch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  torchOn: { backgroundColor: '#FBBF24', borderColor: '#FBBF24' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  infoText: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },

  frame: { width: FRAME_W, height: FRAME_H },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: '#FFFFFF' },
  cornerTL: { top: 0, left: 0, borderTopWidth: CORNER_W, borderLeftWidth: CORNER_W, borderTopLeftRadius: 6 },
  cornerTR: { top: 0, right: 0, borderTopWidth: CORNER_W, borderRightWidth: CORNER_W, borderTopRightRadius: 6 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: CORNER_W, borderLeftWidth: CORNER_W, borderBottomLeftRadius: 6 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: CORNER_W, borderRightWidth: CORNER_W, borderBottomRightRadius: 6 },
  sweep: {
    position: 'absolute',
    left: 10,
    right: 10,
    height: 2,
    borderRadius: 2,
    backgroundColor: '#60A5FA',
  },
  scannedBadge: {
    position: 'absolute',
    alignSelf: 'center',
    top: '50%',
    marginTop: -14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15,23,42,0.82)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  scannedText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' },

  permissionCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(15,23,42,0.75)',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: spacing.xl,
  },
  permissionIcon: {
    width: 54,
    height: 54,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  permissionTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  permissionText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  permissionAction: { marginTop: spacing.xl, alignSelf: 'stretch' },

  footer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md, gap: spacing.md },
  historyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(15,23,42,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  chipText: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '600', fontFamily: 'monospace' },

  footerActions: { flexDirection: 'row', gap: spacing.md },
  footerButton: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: 'rgba(15,23,42,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  footerButtonPrimary: { backgroundColor: palette.brand, borderColor: palette.brand },
  footerButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.72 },

  sheetScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: palette.overlayScrim },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: palette.background,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.borderStrong,
    marginBottom: spacing.lg,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: palette.textPrimary },
  sheetHint: { fontSize: 13, color: palette.textSecondary, marginTop: 4, marginBottom: spacing.lg },
  sheetInput: {
    borderWidth: 1.5,
    borderColor: palette.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: palette.surface,
    color: palette.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  sheetError: { marginTop: spacing.sm, color: palette.danger, fontSize: 13, fontWeight: '600' },
  sheetAction: { marginTop: spacing.lg, marginBottom: spacing.sm },
});
