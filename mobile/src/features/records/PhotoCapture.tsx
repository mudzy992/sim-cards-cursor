import axios from 'axios';
import { Alert, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { installationRecordsApi } from '@/api/installation-records.api';
import { palette, spacing, type } from '@/theme/tokens';
import { ActionButton } from '@/components/ui/ActionButton';
import { Panel } from '@/components/ui/Panel';
import { StatusBadge } from '@/components/ui/StatusBadge';

export function PhotoCapture({
  isOnline,
  serialNumber,
  year,
  uploadedPaths,
  localUris,
  onUploaded,
  onLocal,
  loading,
  onLoading,
}: {
  isOnline: boolean;
  serialNumber: string;
  year: string;
  uploadedPaths: string[];
  localUris: string[];
  onUploaded: (paths: string[]) => void;
  onLocal: (uris: string[]) => void;
  loading: boolean;
  onLoading: (v: boolean) => void;
}) {
  const capture = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Dozvola za kameru', 'Za snimanje fotografija potrebna je dozvola za kameru.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.8 });
    const uri = result.canceled ? undefined : result.assets[0]?.uri;
    if (!uri) return;
    onLoading(true);
    try {
      if (!isOnline) { onLocal([...localUris, uri]); return; }
      const parsedYear = year ? Number.parseInt(year, 10) : undefined;
      const path = await installationRecordsApi.uploadPhoto(uri, {
        serialNumber: serialNumber.trim(),
        year: typeof parsedYear === 'number' && Number.isFinite(parsedYear) ? parsedYear : undefined,
      });
      onUploaded([...uploadedPaths, path]);
    } catch (error) {
      if (axios.isAxiosError(error) && !error.response) { onLocal([...localUris, uri]); return; }
      const message = axios.isAxiosError(error) && typeof error.response?.data?.message === 'string'
        ? error.response.data.message : 'Upload fotografije nije uspio.';
      Alert.alert('Greška', message);
    } finally { onLoading(false); }
  };

  return (
    <View>
      <Text style={[type.sectionLabel, styles.heading]}>Fotografije</Text>
      <Panel>
        <View style={styles.statuses}>
          <StatusBadge tone="success" label={`Poslano ${uploadedPaths.length}`} />
          <StatusBadge tone={localUris.length ? 'warning' : 'neutral'} label={`Čeka ${localUris.length}`} />
        </View>
        <Text style={[type.caption, styles.help]}>Fotografije su opcionalne. Offline snimci šalju se iz outbox reda kada se veza vrati.</Text>
        <ActionButton title="Dodaj fotografiju" icon="camera-outline" onPress={() => void capture()}
          loading={loading} variant="secondary" />
      </Panel>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { marginBottom: spacing.md },
  statuses: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  help: { marginVertical: spacing.lg, lineHeight: 18, color: palette.textSecondary },
});