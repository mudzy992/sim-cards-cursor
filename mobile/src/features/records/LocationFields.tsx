import { Alert, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { spacing, type } from '@/theme/tokens';
import { Field } from '@/components/ui/Field';
import { ActionButton } from '@/components/ui/ActionButton';
import { Panel } from '@/components/ui/Panel';

export function LocationFields({
  latitude,
  longitude,
  onLatitude,
  onLongitude,
  loading,
  onLoading,
}: {
  latitude: string;
  longitude: string;
  onLatitude: (v: string) => void;
  onLongitude: (v: string) => void;
  loading: boolean;
  onLoading: (v: boolean) => void;
}) {
  const fetchLocation = async () => {
    onLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Dozvola za lokaciju', 'Za automatski unos GPS koordinata omogućite lokaciju u postavkama uređaja.');
        return;
      }
      const result = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      onLatitude(result.coords.latitude.toFixed(6));
      onLongitude(result.coords.longitude.toFixed(6));
    } catch {
      Alert.alert('GPS nije dostupan', 'Provjerite da je lokacija uključena i pokušajte ponovo.');
    } finally {
      onLoading(false);
    }
  };

  return (
    <View>
      <Text style={[type.sectionLabel, styles.heading]}>GPS lokacija</Text>
      <Panel tone={latitude && longitude ? 'success' : 'default'} style={styles.panel}>
        <Text style={type.caption}>
          Automatski dohvat je preporučen radi tačne evidencije terenske lokacije.
        </Text>
        <View style={styles.fields}>
          <Field label="Širina" value={latitude} onChangeText={onLatitude} keyboardType="decimal-pad" style={styles.field} />
          <Field label="Dužina" value={longitude} onChangeText={onLongitude} keyboardType="decimal-pad" style={styles.field} />
        </View>
        <ActionButton title={latitude && longitude ? 'Osvježi GPS' : 'Dohvati GPS'} icon="location-outline"
          onPress={() => void fetchLocation()} loading={loading} variant="secondary" />
      </Panel>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { marginBottom: spacing.md },
  panel: { marginBottom: spacing.xl },
  fields: { marginTop: spacing.lg },
  field: { fontFamily: 'monospace' },
});