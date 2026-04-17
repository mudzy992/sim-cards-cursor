import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAudioPlayer } from 'expo-audio';
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Pressable, Text, TextInput, View, Vibration } from 'react-native';
import { colors } from '@/theme/colors';
import { KeyboardAwareScreen } from '@/components/common/KeyboardAwareScreen'
import { ScreenHeader } from '@/components/common/ScreenHeader'
import { Card } from '@/components/common/Card'

export default function ScanScreen() {
  const router = useRouter();
  const routeParams = useLocalSearchParams<{
    afterScan?: string
    demountTaskId?: string
    installTaskId?: string
  }>();
  const afterScan =
    typeof routeParams.afterScan === 'string'
      ? routeParams.afterScan
      : routeParams.afterScan?.[0];
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
  const [scanError, setScanError] = useState<string | null>(null);
  const [hasScanned, setHasScanned] = useState(false);
  const beepPlayer = useAudioPlayer(require('../../../assets/scan-beep.mp3'));

  useFocusEffect(
    useCallback(() => {
      setHasScanned(false);
      setScanError(null);
    }, []),
  );

  const openResult = useCallback(
    (rawIccid: string) => {
      const iccid = rawIccid.trim();
      if (!iccid) {
        setScanError('Nevažeći ICCID.');
        return;
      }

      setHasScanned(true);
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
        })
        return
      }
      router.push({
        pathname: '/(app)/scan-result',
        params: { iccid },
      });
    },
    [router, afterScan, demountTaskId, installTaskId],
  );

  const handleBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (hasScanned) {
        return;
      }

      Vibration.vibrate(50);
      try {
        beepPlayer.seekTo(0);
        void beepPlayer.play();
      } catch {
        // fallback samo na vibraciju
      }
      openResult(String(data));
    },
    [beepPlayer, hasScanned, openResult],
  );

  const hasPermission = permission?.granted === true;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Skeniranje"
        subtitle="Skeniraj barkod kamerom ili unesi ICCID ručno."
      />
      <KeyboardAwareScreen contentStyle={{ paddingTop: 14 }}>
        <Text style={{ color: colors.textMuted }}>
          Poravnaj barkod unutar označenog okvira za najpreciznije skeniranje.
        </Text>

        {!permission ? (
          <Text style={{ color: colors.textMuted }}>Provjeravam dozvole kamere...</Text>
        ) : null}

        {permission && !hasPermission ? (
          <Card style={{ padding: 12, gap: 8 }}>
            <Text style={{ color: colors.text }}>Pristup kameri nije odobren.</Text>
            <Pressable
              onPress={() => void requestPermission()}
              style={({ pressed }) => ({
                backgroundColor: pressed ? colors.primaryPressed : colors.primary,
                padding: 12,
                borderRadius: 10,
                alignItems: 'center',
              })}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>Dozvoli kameru</Text>
            </Pressable>
          </Card>
        ) : null}

        {hasPermission ? (
          <View
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 14,
              overflow: 'hidden',
              height: 280,
              position: 'relative',
              backgroundColor: colors.surface,
              elevation: 1,
            }}
          >
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              onBarcodeScanned={hasScanned ? undefined : handleBarcodeScanned}
            />
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  width: '80%',
                  height: 180,
                  borderWidth: 2,
                  borderColor: colors.primary,
                  borderRadius: 18,
                  backgroundColor: 'rgba(22,72,155,0.08)',
                }}
              />
            </View>
          </View>
        ) : null}

        <Pressable
          onPress={() => {
            setHasScanned(false);
            setScanError(null);
          }}
          style={({ pressed }) => ({
            backgroundColor: pressed ? '#0f172a' : '#334155',
            padding: 12,
            borderRadius: 12,
            alignItems: 'center',
          })}
        >
          <Text style={{ color: '#fff', fontWeight: '800' }}>Skeniraj ponovo</Text>
        </Pressable>

        <Card style={{ padding: 12, gap: 8 }}>
          <Text style={{ fontSize: 12, fontWeight: '800', letterSpacing: 0.4, color: colors.textMuted }}>
            RUČNI UNOS
          </Text>
          <TextInput
            value={manualIccid}
            onChangeText={(text) => {
              const digitsOnly = text.replace(/\D/g, '')
              setManualIccid(digitsOnly)
              if (scanError) setScanError(null)
            }}
            placeholder="ICCID"
            autoCapitalize="none"
            keyboardType="number-pad"
            inputMode="numeric"
            returnKeyType="done"
            onSubmitEditing={() => openResult(manualIccid)}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              padding: 12,
              backgroundColor: colors.surface,
              color: colors.text,
              fontWeight: '700',
              letterSpacing: 0.3,
            }}
          />
        </Card>

        <Pressable
          onPress={() => openResult(manualIccid)}
          style={({ pressed }) => ({
            backgroundColor: pressed ? colors.primaryPressed : colors.primary,
            padding: 14,
            borderRadius: 12,
            alignItems: 'center',
          })}
        >
          <Text style={{ color: '#fff', fontWeight: '900' }}>Provjeri ICCID</Text>
        </Pressable>

        {scanError ? <Text style={{ color: colors.danger, fontWeight: '700' }}>{scanError}</Text> : null}
      </KeyboardAwareScreen>
    </View>
  );
}
