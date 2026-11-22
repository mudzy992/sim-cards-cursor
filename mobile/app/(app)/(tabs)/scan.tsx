import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import { extractTextFromImage, isSupported as isOcrSupported } from 'expo-text-extractor';
import {
  isValidIccid,
  normalizeIccid,
  validateMeterSerialLength,
} from '@sim-tracker/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAudioPlayer } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { APP_ASSETS } from '@/constants/assets';
import { useTranslation } from '@/i18n/i18n.store';
import {
  radii,
  spacing,
  useTheme,
  useThemedStyles,
  type ThemePalette,
} from '@/theme/tokens';
import { ActionButton } from '@/components/ui/ActionButton';
import { hapticError, hapticSuccess } from '@/utils/haptics';
import { extractOcrCandidates } from '@/utils/ocr-parser';

const { width: SCREEN_W } = Dimensions.get('window');
const FRAME_W = Math.min(SCREEN_W * 0.78, 320);
const FRAME_H = Math.round(FRAME_W / 2.1);

function pickParam(value?: string | string[]): string | undefined {
  return typeof value === 'string' ? value : value?.[0];
}

export default function ScanScreen() {
  const router = useRouter();
  const { palette } = useTheme();
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);

  const routeParams = useLocalSearchParams<{
    afterScan?: string | string[];
    demountTaskId?: string | string[];
    installTaskId?: string | string[];
    returnTo?: string | string[];
    simCardId?: string | string[];
    serialTarget?: string | string[];
    expectedSerialLength?: string | string[];
  }>();

  const afterScan = pickParam(routeParams.afterScan);
  const demountTaskId = pickParam(routeParams.demountTaskId);
  const installTaskId = pickParam(routeParams.installTaskId);
  const returnTo = pickParam(routeParams.returnTo);
  const simCardId = pickParam(routeParams.simCardId);
  const serialTarget = pickParam(routeParams.serialTarget);
  const rawExpectedSerialLength = pickParam(routeParams.expectedSerialLength);
  const parsedExpectedLength = rawExpectedSerialLength
    ? Number.parseInt(rawExpectedSerialLength, 10)
    : NaN;
  const expectedSerialLength =
    Number.isInteger(parsedExpectedLength) && parsedExpectedLength > 0
      ? parsedExpectedLength
      : null;
  const isMeterSerialMode = afterScan === 'meterSerial';

  const [permission, requestPermission] = useCameraPermissions();
  const [manualValue, setManualValue] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [hasScanned, setHasScanned] = useState(false);
  const [torch, setTorch] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrCandidates, setOcrCandidates] = useState<string[]>([]);
  const [ocrTriggered, setOcrTriggered] = useState(false);
  const [ocrNotice, setOcrNotice] = useState<string | null>(null);
  const beepPlayer = useAudioPlayer(APP_ASSETS.scanBeep);
  const cameraRef = useRef<CameraView | null>(null);

  const flash = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      setHasScanned(false);
      setScanError(null);
      return () => setTorch(false);
    }, []),
  );

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
    hapticSuccess();
    try {
      beepPlayer.seekTo(0);
      void beepPlayer.play();
    } catch {
      // fallback only to vibration
    }
    flash.setValue(1);
    Animated.timing(flash, {
      toValue: 0,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }, [beepPlayer, flash]);

  const openResult = useCallback(
    (rawValue: string) => {
      if (isMeterSerialMode) {
        const cleaned = rawValue.trim();
        if (cleaned.length < 3 || cleaned.length > 64) {
          setScanError(t('mobile.scan.invalidSerial'));
          return;
        }
        const lengthCheck = validateMeterSerialLength(
          cleaned,
          expectedSerialLength,
        );
        if (!lengthCheck.valid && lengthCheck.expectedLength) {
          setScanError(
            t('mobile.records.form.serialLengthMismatchError', {
              expected: lengthCheck.expectedLength,
            }),
          );
          return;
        }
        setHasScanned(true);
        setManualOpen(false);
        setTorch(false);
        const targetPath =
          returnTo === 'create-record-replacement'
            ? '/(app)/create-record-replacement'
            : '/(app)/create-record';
        router.replace({
          pathname: targetPath,
          params: {
            ...(simCardId ? { simCardId } : {}),
            pickedSerial: cleaned,
            ...(serialTarget ? { pickedSerialTarget: serialTarget } : {}),
          },
        });
        return;
      }

      const iccid = normalizeIccid(rawValue);
      if (!iccid || !isValidIccid(iccid)) {
        setScanError(t('mobile.scan.invalidIccid'));
        return;
      }
      setHasScanned(true);
      setManualOpen(false);
      setTorch(false);
      setHistory((prev) =>
        [iccid, ...prev.filter((value) => value !== iccid)].slice(0, 3),
      );

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
    [
      router,
      afterScan,
      demountTaskId,
      expectedSerialLength,
      installTaskId,
      isMeterSerialMode,
      returnTo,
      simCardId,
      serialTarget,
      t,
    ],
  );

  const handleBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (hasScanned || ocrBusy || manualOpen) return;
      playFeedback();
      openResult(String(data));
    },
    [hasScanned, manualOpen, ocrBusy, openResult, playFeedback],
  );

  const handleOcrScan = useCallback(async () => {
    if (ocrBusy) return;
    if (permission?.granted !== true) {
      await requestPermission();
      return;
    }
    if (!isOcrSupported) {
      hapticError();
      setOcrCandidates([]);
      setOcrTriggered(true);
      setOcrNotice(t('mobile.scan.ocrNotSupported'));
      setManualValue('');
      setScanError(null);
      setManualOpen(true);
      return;
    }

    setOcrBusy(true);
    setScanError(null);
    setOcrNotice(null);
    let capturedUri: string | undefined;
    try {
      const photo = await cameraRef.current?.takePictureAsync({
        quality: 0.85,
      });
      capturedUri = photo?.uri;
      if (!capturedUri) {
        throw new Error('capture_failed');
      }
      const lines = await extractTextFromImage(capturedUri);
      const candidates = extractOcrCandidates(lines, {
        mode: isMeterSerialMode ? 'meterSerial' : 'iccid',
        expectedSerialLength,
      });
      setOcrTriggered(true);
      if (candidates.length > 0) {
        playFeedback();
        setOcrCandidates(candidates);
        setManualValue(candidates[0] ?? '');
        setOcrNotice(null);
      } else {
        hapticError();
        setOcrCandidates([]);
        setManualValue('');
        setOcrNotice(t('mobile.scan.ocrNoMatch'));
      }
      setManualOpen(true);
    } catch {
      hapticError();
      setOcrTriggered(true);
      setOcrCandidates([]);
      setManualValue('');
      setOcrNotice(t('mobile.scan.ocrFailed'));
      setManualOpen(true);
    } finally {
      if (capturedUri) {
        void FileSystem.deleteAsync(capturedUri, { idempotent: true }).catch(
          () => {},
        );
      }
      setOcrBusy(false);
    }
  }, [
    expectedSerialLength,
    isMeterSerialMode,
    ocrBusy,
    permission?.granted,
    playFeedback,
    requestPermission,
    t,
  ]);

  const hasPermission = permission?.granted === true;
  const contextLabel = isMeterSerialMode
    ? t('mobile.scan.contextMeterSerial')
    : afterScan === 'install'
      ? t('mobile.scan.contextInstall')
      : afterScan === 'demount'
        ? t('mobile.scan.contextDemount')
        : afterScan === 'inventory'
          ? t('mobile.scan.contextInventory')
          : t('mobile.scan.contextDefault');

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {hasPermission ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          onBarcodeScanned={
            hasScanned || ocrBusy || manualOpen
              ? undefined
              : handleBarcodeScanned
          }
          barcodeScannerSettings={{
            barcodeTypes: ['code128', 'code39', 'ean13', 'qr', 'datamatrix'],
          }}
        />
      ) : null}

      <Animated.View
        pointerEvents="none"
        style={[styles.flash, { opacity: flash }]}
      />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{contextLabel}</Text>
            <Text style={styles.subtitle}>{t('mobile.scan.subtitle')}</Text>
          </View>
          {hasPermission ? (
            <Pressable
              testID="scan-torch-btn"
              onPress={() => setTorch((value) => !value)}
              accessibilityRole="button"
              accessibilityLabel={
                torch ? t('mobile.scan.torchOff') : t('mobile.scan.torchOn')
              }
              style={({ pressed }) => [
                styles.torch,
                torch && styles.torchOn,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name={torch ? 'flashlight' : 'flashlight-outline'}
                size={20}
                color={torch ? palette.graphite : palette.cameraFg}
              />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.center}>
          {!permission ? (
            <Text style={styles.infoText}>
              {t('mobile.scan.checkingPermission')}
            </Text>
          ) : !hasPermission ? (
            <View style={styles.permissionCard}>
              <View style={styles.permissionIcon}>
                <Ionicons
                  name="camera-outline"
                  size={26}
                  color={palette.cameraFg}
                />
              </View>
              <Text style={styles.permissionTitle}>
                {t('mobile.scan.noPermissionTitle')}
              </Text>
              <Text style={styles.permissionText}>
                {t('mobile.scan.noPermissionBody')}
              </Text>
              <ActionButton
                title={t('mobile.scan.allowCamera')}
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
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color={palette.successBorder}
                  />
                  <Text style={styles.scannedText}>
                    {t('mobile.scan.scannedBadge')}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        <View style={styles.footer}>
          {!isMeterSerialMode && history.length > 0 ? (
            <View style={styles.historyRow}>
              {history.map((iccid) => (
                <Pressable
                  key={iccid}
                  onPress={() => openResult(iccid)}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.chip,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons
                    name="time-outline"
                    size={12}
                    color={palette.cameraFg}
                  />
                  <Text style={styles.chipText} numberOfLines={1}>
                    {iccid.length > 12 ? `…${iccid.slice(-10)}` : iccid}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={styles.footerActions}>
            {hasPermission ? (
              <Pressable
                testID="scan-ocr-btn"
                disabled={ocrBusy}
                onPress={() => void handleOcrScan()}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.footerButton,
                  styles.footerButtonOcr,
                  (pressed || ocrBusy) && styles.pressed,
                ]}
              >
                {ocrBusy ? (
                  <ActivityIndicator size="small" color={palette.cameraFg} />
                ) : (
                  <Ionicons
                    name="text-outline"
                    size={18}
                    color={palette.cameraFg}
                  />
                )}
                <Text style={styles.footerButtonText} numberOfLines={1}>
                  {ocrBusy
                    ? t('mobile.scan.ocrRunning')
                    : t('mobile.scan.ocrButton')}
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              testID="scan-manual-open-btn"
              onPress={() => {
                setManualValue('');
                setScanError(null);
                setOcrCandidates([]);
                setOcrTriggered(false);
                setOcrNotice(null);
                setManualOpen(true);
              }}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.footerButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name="keypad-outline"
                size={18}
                color={palette.cameraFg}
              />
              <Text style={styles.footerButtonText} numberOfLines={1}>
                {t('mobile.scan.manualButton')}
              </Text>
            </Pressable>

            {hasScanned ? (
              <Pressable
                testID="scan-again-btn"
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
                <Ionicons
                  name="refresh"
                  size={18}
                  color={palette.cameraFg}
                />
                <Text style={styles.footerButtonText} numberOfLines={1}>
                  {t('mobile.scan.scanAgain')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </SafeAreaView>

      <Modal
        visible={manualOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setManualOpen(false)}
      >
        <Pressable
          style={styles.sheetScrim}
          onPress={() => setManualOpen(false)}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>
              {ocrTriggered
                ? isMeterSerialMode
                  ? t('mobile.scan.ocrSerialTitle')
                  : t('mobile.scan.ocrIccidTitle')
                : isMeterSerialMode
                  ? t('mobile.scan.manualSerialTitle')
                  : t('mobile.scan.manualIccidTitle')}
            </Text>
            <Text style={styles.sheetHint}>
              {isMeterSerialMode && expectedSerialLength
                ? t('mobile.scan.ocrExpectedLengthHint', {
                    count: expectedSerialLength,
                  })
                : t('mobile.scan.manualHint')}
            </Text>
            {ocrNotice ? (
              <Text style={styles.sheetNotice}>{ocrNotice}</Text>
            ) : null}
            {ocrCandidates.length > 0 ? (
              <View style={styles.ocrCandidatesWrap}>
                <Text style={styles.ocrCandidatesLabel}>
                  {t('mobile.scan.ocrCandidatesLabel')}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.ocrCandidatesList}
                >
                  {ocrCandidates.map((candidate) => {
                    const selected = manualValue.trim() === candidate;
                    return (
                      <Pressable
                        key={candidate}
                        testID={`ocr-candidate-${candidate}`}
                        onPress={() => {
                          setManualValue(candidate);
                          if (scanError) setScanError(null);
                        }}
                        accessibilityRole="button"
                        style={({ pressed }) => [
                          styles.ocrCandidateChip,
                          selected && styles.ocrCandidateChipSelected,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text
                          style={[
                            styles.ocrCandidateText,
                            selected && styles.ocrCandidateTextSelected,
                          ]}
                        >
                          {candidate}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}
            <TextInput
              testID="scan-manual-input"
              value={manualValue}
              onChangeText={(text) => {
                setManualValue(
                  isMeterSerialMode ? text : text.replace(/\D/g, ''),
                );
                if (scanError) setScanError(null);
              }}
              placeholder={
                isMeterSerialMode ? 'npr. AMM-123456' : 'npr. 89387012345678901234'
              }
              placeholderTextColor={palette.textMuted}
              keyboardType={isMeterSerialMode ? 'default' : 'number-pad'}
              autoCapitalize={isMeterSerialMode ? 'characters' : 'none'}
              returnKeyType="done"
              autoFocus
              onSubmitEditing={() => openResult(manualValue)}
              style={styles.sheetInput}
            />
            {scanError ? (
              <Text style={styles.sheetError}>{scanError}</Text>
            ) : null}
            <ActionButton
              testID="scan-manual-submit-btn"
              title={
                isMeterSerialMode
                  ? t('mobile.scan.confirmSerial')
                  : t('mobile.scan.checkIccid')
              }
              icon={isMeterSerialMode ? 'checkmark' : 'search'}
              size="lg"
              disabled={manualValue.trim().length === 0}
              onPress={() => openResult(manualValue)}
              style={styles.sheetAction}
            />
            <ActionButton
              title={t('mobile.common.cancel')}
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
  const styles = useThemedStyles(createStyles);
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

const createStyles = (palette: ThemePalette) => ({
  root: { flex: 1, backgroundColor: palette.cameraBg },
  safe: { flex: 1, justifyContent: 'space-between' as const },
  flash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.successSoft,
  },

  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  headerText: { flex: 1, minWidth: 0 },
  title: {
    color: palette.cameraFg,
    fontSize: 17,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
  },
  subtitle: {
    color: palette.cameraFg,
    opacity: 0.78,
    fontSize: 12.5,
    marginTop: 2,
  },
  torch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: palette.overlayScrim,
    borderWidth: 1,
    borderColor: palette.border,
  },
  torchOn: {
    backgroundColor: palette.cameraTorchActive,
    borderColor: palette.cameraTorchActive,
  },

  center: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: spacing.xl,
  },
  infoText: { color: palette.cameraFg, fontSize: 14 },

  frame: { width: FRAME_W, height: FRAME_H },
  corner: {
    position: 'absolute' as const,
    width: CORNER,
    height: CORNER,
    borderColor: palette.cameraFg,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_W,
    borderLeftWidth: CORNER_W,
    borderTopLeftRadius: 6,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_W,
    borderRightWidth: CORNER_W,
    borderTopRightRadius: 6,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_W,
    borderLeftWidth: CORNER_W,
    borderBottomLeftRadius: 6,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_W,
    borderRightWidth: CORNER_W,
    borderBottomRightRadius: 6,
  },
  sweep: {
    position: 'absolute' as const,
    left: 10,
    right: 10,
    height: 2,
    borderRadius: 2,
    backgroundColor: palette.cameraSweep,
  },
  scannedBadge: {
    position: 'absolute' as const,
    alignSelf: 'center' as const,
    top: '50%' as const,
    marginTop: -14,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: palette.overlayScrim,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  scannedText: {
    color: palette.cameraFg,
    fontSize: 12.5,
    fontWeight: '700' as const,
  },

  permissionCard: {
    alignItems: 'center' as const,
    backgroundColor: palette.overlayScrim,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.xl,
  },
  permissionIcon: {
    width: 54,
    height: 54,
    borderRadius: radii.md,
    backgroundColor: palette.graphiteSoft,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: spacing.lg,
  },
  permissionTitle: {
    color: palette.cameraFg,
    fontSize: 16,
    fontWeight: '700' as const,
    textAlign: 'center' as const,
  },
  permissionText: {
    color: palette.cameraFg,
    opacity: 0.8,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center' as const,
    marginTop: spacing.sm,
  },
  permissionAction: { marginTop: spacing.xl, alignSelf: 'stretch' as const },

  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  historyRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    backgroundColor: palette.overlayScrim,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  chipText: {
    color: palette.cameraFg,
    fontSize: 11.5,
    fontWeight: '600' as const,
    fontFamily: 'monospace' as const,
  },

  footerActions: { flexDirection: 'row' as const, gap: spacing.md },
  footerButton: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: palette.overlayScrim,
    borderWidth: 1,
    borderColor: palette.border,
  },
  footerButtonPrimary: {
    backgroundColor: palette.brand,
    borderColor: palette.brand,
  },
  footerButtonOcr: {
    backgroundColor: palette.graphite,
    borderColor: palette.borderStrong,
  },
  footerButtonText: {
    color: palette.cameraFg,
    fontSize: 13.5,
    fontWeight: '600' as const,
  },
  pressed: { opacity: 0.72 },

  sheetScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.overlayScrim,
  },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' as const },
  sheet: {
    backgroundColor: palette.background,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  sheetHandle: {
    alignSelf: 'center' as const,
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.borderStrong,
    marginBottom: spacing.lg,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: palette.textPrimary,
  },
  sheetHint: {
    fontSize: 13,
    color: palette.textSecondary,
    marginTop: 4,
    marginBottom: spacing.md,
  },
  sheetNotice: {
    fontSize: 12.5,
    color: palette.warning,
    backgroundColor: palette.warningSoft,
    borderColor: palette.warningBorder,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  ocrCandidatesWrap: {
    marginBottom: spacing.md,
  },
  ocrCandidatesLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: palette.textSecondary,
    marginBottom: spacing.xs,
  },
  ocrCandidatesList: {
    gap: spacing.sm,
  },
  ocrCandidateChip: {
    borderWidth: 1,
    borderColor: palette.borderStrong,
    borderRadius: radii.sm,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  ocrCandidateChipSelected: {
    borderColor: palette.infoBorder,
    backgroundColor: palette.brandSoft,
  },
  ocrCandidateText: {
    fontFamily: 'monospace' as const,
    fontSize: 13.5,
    fontWeight: '600' as const,
    color: palette.textPrimary,
  },
  ocrCandidateTextSelected: {
    color: palette.brandText,
  },
  sheetInput: {
    borderWidth: 1.5,
    borderColor: palette.borderStrong,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: palette.surface,
    color: palette.textPrimary,
    fontSize: 17,
    fontWeight: '700' as const,
    fontFamily: 'monospace' as const,
    letterSpacing: 1,
  },
  sheetError: {
    marginTop: spacing.sm,
    color: palette.danger,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  sheetAction: { marginTop: spacing.lg, marginBottom: spacing.sm },
});
