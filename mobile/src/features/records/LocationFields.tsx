import { Alert, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { useTranslation } from '@/i18n/i18n.store';
import {
  spacing,
  useTheme,
  useThemedStyles,
  type ThemePalette,
} from '@/theme/tokens';
import { Field } from '@/components/ui/Field';
import { ActionButton } from '@/components/ui/ActionButton';
import { Panel } from '@/components/ui/Panel';
import { hapticSuccess, hapticWarning } from '@/utils/haptics';

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
  const { type } = useTheme();
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);

  const fetchLocation = async () => {
    onLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        hapticWarning();
        Alert.alert(
          t('mobile.records.form.gpsPermTitle'),
          t('mobile.records.form.gpsPermBody'),
        );
        return;
      }
      const result = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      onLatitude(result.coords.latitude.toFixed(6));
      onLongitude(result.coords.longitude.toFixed(6));
      hapticSuccess();
    } catch {
      hapticWarning();
      Alert.alert(
        t('mobile.records.form.gpsUnavailableTitle'),
        t('mobile.records.form.gpsUnavailableBody'),
      );
    } finally {
      onLoading(false);
    }
  };

  return (
    <View>
      <Text style={[type.sectionLabel, styles.heading]}>
        {t('mobile.records.form.gpsTitle')}
      </Text>
      <Panel
        tone={latitude && longitude ? 'success' : 'default'}
        style={styles.panel}
      >
        <Text style={type.caption}>{t('mobile.records.form.gpsSubtitle')}</Text>
        <View style={styles.fields}>
          <Field
            testID="location-latitude-input"
            label={t('mobile.records.form.gpsLat')}
            value={latitude}
            onChangeText={onLatitude}
            keyboardType="decimal-pad"
            style={styles.field}
          />
          <Field
            testID="location-longitude-input"
            label={t('mobile.records.form.gpsLon')}
            value={longitude}
            onChangeText={onLongitude}
            keyboardType="decimal-pad"
            style={styles.field}
          />
        </View>
        <ActionButton
          testID="location-fetch-gps-btn"
          title={
            latitude && longitude
              ? t('mobile.records.form.gpsRefresh')
              : t('mobile.records.form.gpsFetch')
          }
          icon="location-outline"
          onPress={() => void fetchLocation()}
          loading={loading}
          variant="secondary"
        />
      </Panel>
    </View>
  );
}

const createStyles = (_palette: ThemePalette) => ({
  heading: { marginBottom: spacing.md },
  panel: { marginBottom: spacing.xl },
  fields: { marginTop: spacing.lg },
  field: { fontFamily: 'monospace' as const },
});
