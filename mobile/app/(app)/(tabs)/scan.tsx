import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useAudioPlayer } from 'expo-audio';
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Pressable, Text, TextInput, View, Vibration } from 'react-native';
import { colors } from '@/theme/colors';

export default function ScanScreen() {
  const router = useRouter();
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
      router.push({
        pathname: '/(app)/scan-result',
        params: { iccid },
      });
    },
    [router],
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
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: '700' }}>Scan SIM</Text>
      <Text style={{ color: colors.textMuted }}>
        Skeniraj barkod kamerom ili unesi ICCID ručno kao fallback.
      </Text>
      <Text style={{ color: colors.textMuted, marginTop: 2 }}>
        Poravnaj barkod unutar označenog okvira za najpreciznije skeniranje.
      </Text>

      {!permission ? (
        <Text style={{ color: colors.textMuted }}>Provjeravam dozvole kamere...</Text>
      ) : null}

      {permission && !hasPermission ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: '#e2e8f0',
            borderRadius: 12,
            padding: 12,
            gap: 8,
          }}
        >
          <Text>Pristup kameri nije odobren.</Text>
          <Pressable
            onPress={() => void requestPermission()}
            style={({ pressed }) => ({
              backgroundColor: pressed ? colors.primaryPressed : colors.primary,
              padding: 12,
              borderRadius: 10,
              alignItems: 'center',
            })}
          >
            <Text style={{ color: '#fff' }}>Dozvoli kameru</Text>
          </Pressable>
        </View>
      ) : null}

      {hasPermission ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: '#e2e8f0',
            borderRadius: 12,
            overflow: 'hidden',
            height: 280,
            position: 'relative',
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
                borderRadius: 16,
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
        style={{
          backgroundColor: '#334155',
          padding: 10,
          borderRadius: 10,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#fff' }}>Skeniraj ponovo</Text>
      </Pressable>

      <TextInput
        value={manualIccid}
        onChangeText={setManualIccid}
        placeholder="Ručni unos ICCID"
        autoCapitalize="none"
        style={{
          borderWidth: 1,
          borderColor: '#cbd5e1',
          borderRadius: 10,
          padding: 12,
        }}
      />

      <Pressable
        onPress={() => openResult(manualIccid)}
        style={({ pressed }) => ({
          backgroundColor: pressed ? colors.primaryPressed : colors.primary,
          padding: 12,
          borderRadius: 10,
          alignItems: 'center',
        })}
      >
        <Text style={{ color: '#fff' }}>Provjeri ICCID</Text>
      </Pressable>

      {scanError ? <Text style={{ color: '#dc2626' }}>{scanError}</Text> : null}
    </View>
  );
}
