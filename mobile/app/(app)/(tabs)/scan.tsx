import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Pressable, Text, TextInput, View } from 'react-native';

export default function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [manualIccid, setManualIccid] = useState('');
  const [scanError, setScanError] = useState<string | null>(null);
  const [hasScanned, setHasScanned] = useState(false);

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

      openResult(String(data));
    },
    [hasScanned, openResult],
  );

  const hasPermission = permission?.granted === true;

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: '700' }}>Scan SIM</Text>
      <Text style={{ color: '#64748b' }}>
        Skeniraj barkod kamerom ili unesi ICCID ručno kao fallback.
      </Text>

      {!permission ? (
        <Text style={{ color: '#64748b' }}>Provjeravam dozvole kamere...</Text>
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
            style={{
              backgroundColor: '#0f766e',
              padding: 12,
              borderRadius: 10,
              alignItems: 'center',
            }}
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
          }}
        >
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            onBarcodeScanned={hasScanned ? undefined : handleBarcodeScanned}
          />
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
        style={{
          backgroundColor: '#0f766e',
          padding: 12,
          borderRadius: 10,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#fff' }}>Provjeri ICCID</Text>
      </Pressable>

      {scanError ? <Text style={{ color: '#dc2626' }}>{scanError}</Text> : null}
    </View>
  );
}
