/** Novi priključak — vođeni zapisnik ugradnje, produkcijski payload 1:1. */
import axios from 'axios';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { installationRecordsApi, queueInstallationRecord, type CreateInstallationRecordPayload } from '@/api/installation-records.api';
import { meterTypeDefinitionsApi } from '@/api/meter-type-definitions.api';
import { useAuthStore } from '@/store/auth.store';
import { useConnectivity } from '@/hooks/useConnectivity';
import { palette, spacing, type } from '@/theme/tokens';
import { ScreenTitleBar } from '@/components/ui/ScreenTitleBar';
import { WorkflowSteps } from '@/components/ui/WorkflowSteps';
import { Field } from '@/components/ui/Field';
import { Panel } from '@/components/ui/Panel';
import { ActionButton } from '@/components/ui/ActionButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { MeterTypePicker } from '@/features/records/MeterTypePicker';
import { DynamicMeterFields, validateRequiredDynamicFields } from '@/features/tasks/DynamicMeterFields';
import { LocationFields } from '@/features/records/LocationFields';
import { PhotoCapture } from '@/features/records/PhotoCapture';

export default function CreateRecordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ simCardId?: string | string[] }>();
  const simCardId = (typeof params.simCardId === 'string' ? params.simCardId : params.simCardId?.[0])?.trim() ?? '';
  const user = useAuthStore((state) => state.user);
  const { isOnline } = useConnectivity();

  const [meterTypeId, setMeterTypeId] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [year, setYear] = useState('');
  const [calibrationYear, setCalibrationYear] = useState('');
  const [installationAddress, setInstallationAddress] = useState('');
  const [city, setCity] = useState('');
  const [municipality, setMunicipality] = useState('');
  const [measuringPoint, setMeasuringPoint] = useState('');
  const [installationDate, setInstallationDate] = useState(new Date().toISOString().slice(0, 10));
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [notes, setNotes] = useState('');
  const [photoPaths, setPhotoPaths] = useState<string[]>([]);
  const [localPhotoUris, setLocalPhotoUris] = useState<string[]>([]);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [dynamicFieldValues, setDynamicFieldValues] = useState<Record<string, unknown>>({});
  const [clientRequestId] = useState(() => `crid_${Date.now()}_${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    if (user?.role === 'USER' && user.branch?.name) setMunicipality(user.branch.name);
  }, [user?.role, user?.branch?.name]);
  useEffect(() => { setDynamicFieldValues({}); }, [meterTypeId]);

  const meterTypesQuery = useQuery({
    queryKey: ['meter-type-definitions', 'list'],
    queryFn: () => meterTypeDefinitionsApi.list(),
    enabled: Boolean(user?.id),
  });
  const fieldsQuery = useQuery({
    queryKey: ['meter-type-definitions', meterTypeId, 'fields'],
    queryFn: () => meterTypeDefinitionsApi.listFields(meterTypeId),
    enabled: Boolean(meterTypeId),
  });
  const meterTypes = Array.isArray(meterTypesQuery.data) ? meterTypesQuery.data : [];
  const dynamicFields = Array.isArray(fieldsQuery.data) ? fieldsQuery.data : [];
  const typesError = meterTypesQuery.isError || (meterTypesQuery.isFetched && !meterTypesQuery.isLoading && meterTypesQuery.data === undefined);

  const validation = useMemo(() => {
    const missing: string[] = [];
    if (!meterTypeId) missing.push('tip brojila');
    if (!serialNumber.trim()) missing.push('serijski broj');
    if (!year.trim()) missing.push('godina proizvodnje');
    if (!calibrationYear.trim()) missing.push('godina baždarenja');
    missing.push(...validateRequiredDynamicFields(dynamicFields, dynamicFieldValues));
    return missing;
  }, [meterTypeId, serialNumber, year, calibrationYear, dynamicFields, dynamicFieldValues]);

  const buildPayload = (): CreateInstallationRecordPayload & { localPhotoUris?: string[] } => {
    if (!user?.id || !simCardId) throw new Error('Nedostaje korisnik ili SIM kartica.');
    if (validation.length) throw new Error(`Obavezna polja: ${validation.join(', ')}`);
    const yearNumber = Number.parseInt(year, 10);
    const calibrationNumber = Number.parseInt(calibrationYear, 10);
    if (!Number.isFinite(yearNumber) || !Number.isFinite(calibrationNumber)) throw new Error('Godine moraju biti cijeli brojevi.');
    const lat = parseOptionalFloat(latitude);
    const lon = parseOptionalFloat(longitude);
    return {
      simCardId,
      installedById: user.id,
      clientRequestId,
      meterTypeDefinitionId: meterTypeId,
      serialNumber: serialNumber.trim(),
      year: yearNumber,
      calibrationYear: calibrationNumber,
      installationAddress: installationAddress.trim() || undefined,
      installationDate: installationDate || undefined,
      city: city.trim() || undefined,
      municipality: municipality.trim() || undefined,
      branchId: user.branch?.id,
      measuringPoint: measuringPoint.trim() || undefined,
      latitude: lat,
      longitude: lon,
      dynamicFieldValues: Object.keys(dynamicFieldValues).length ? dynamicFieldValues : undefined,
      notes: notes.trim() || undefined,
      photos: photoPaths.length ? photoPaths : undefined,
      ...(localPhotoUris.length ? { localPhotoUris } : {}),
    };
  };

  const createMutation = useMutation({
    mutationFn: () => installationRecordsApi.create(buildPayload()),
    onSuccess: (created) => {
      if (created?.status === 'SEND_FAILED') {
        Alert.alert('Zapisnik je kreiran', 'Slanje emaila nije uspjelo. Pokušajte ponovo iz detalja zapisnika.', [
          { text: 'Detalji', onPress: () => router.replace({ pathname: '/(app)/record-details', params: { id: created.id } }) },
          { text: 'Kasnije', onPress: () => router.replace('/(app)/(tabs)/records') },
        ]);
        return;
      }
      Alert.alert('Uspjeh', 'Zapisnik je kreiran i poslan na email.', [
        { text: 'OK', onPress: () => router.replace('/(app)/(tabs)/records') },
      ]);
    },
    onError: async (error) => {
      if (axios.isAxiosError(error) && !error.response) {
        try {
          await queueInstallationRecord(buildPayload());
          Alert.alert('Sačuvano offline', 'Zapisnik će biti automatski poslan kada se veza uspostavi.', [
            { text: 'OK', onPress: () => router.replace('/(app)/(tabs)/records') },
          ]);
          return;
        } catch { /* nastavi na standardnu poruku */ }
      }
      const message = axios.isAxiosError(error) && typeof error.response?.data?.message === 'string'
        ? error.response.data.message : error instanceof Error ? error.message : 'Kreiranje zapisnika nije uspjelo.';
      Alert.alert('Greška', message);
    },
  });

  if (!simCardId) {
    return <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenTitleBar title="Novi priključak" onBack={() => router.back()} />
      <EmptyState icon="alert-circle-outline" title="Nedostaje SIM kartica"
        description="Vratite se na skeniranje, zadužite karticu i odaberite kreiranje zapisnika."
        actionLabel="Nazad" onAction={() => router.back()} />
    </SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenTitleBar title="Novi priključak" subtitle="Zapisnik ugradnje SIM kartice" onBack={() => router.back()} />
      <KeyboardAwareScrollView contentContainerStyle={styles.content} bottomOffset={24} keyboardShouldPersistTaps="handled">
        <WorkflowSteps header="NOVI PRIKLJUČAK · PODACI" steps={[
          { key: 'sim', label: 'SIM kartica', state: 'done', detail: simCardId },
          { key: 'meter', label: 'Brojilo', state: meterTypeId && serialNumber ? 'done' : 'current' },
          { key: 'location', label: 'Lokacija', state: meterTypeId && serialNumber ? 'current' : 'pending' },
          { key: 'confirm', label: 'Potvrda', state: validation.length ? 'pending' : 'current' },
        ]} />

        <Text style={[type.sectionLabel, styles.sectionTitle]}>Brojilo</Text>
        <MeterTypePicker items={meterTypes} value={meterTypeId} onChange={setMeterTypeId}
          loading={meterTypesQuery.isLoading} error={typesError} />
        <Field label="Serijski broj brojila" required value={serialNumber} onChangeText={setSerialNumber} autoCapitalize="characters" />
        <View style={styles.twoFields}>
          <Field label="Godina proizvodnje" required value={year} onChangeText={(v) => setYear(v.replace(/\D/g, ''))} keyboardType="number-pad" style={styles.flexField} />
          <Field label="Godina baždarenja" required value={calibrationYear} onChangeText={(v) => setCalibrationYear(v.replace(/\D/g, ''))} keyboardType="number-pad" style={styles.flexField} />
        </View>
        {meterTypeId ? <DynamicMeterFields fields={dynamicFields} values={dynamicFieldValues}
          loading={fieldsQuery.isLoading} error={fieldsQuery.isError}
          onChange={(name, value) => setDynamicFieldValues((current) => ({ ...current, [name]: value }))} /> : null}

        <Text style={[type.sectionLabel, styles.sectionTitle]}>Lokacija ugradnje</Text>
        <Field label="Adresa instalacije" value={installationAddress} onChangeText={setInstallationAddress} placeholder="Ulica i broj" />
        <Field label="Grad" value={city} onChangeText={setCity} />
        <Field label="Općina" value={municipality} onChangeText={setMunicipality} />
        <Field label="Mjerno mjesto" value={measuringPoint} onChangeText={setMeasuringPoint} />
        <Field label="Datum instalacije" value={installationDate} onChangeText={setInstallationDate} placeholder="YYYY-MM-DD" />
        <LocationFields latitude={latitude} longitude={longitude} onLatitude={setLatitude} onLongitude={setLongitude}
          loading={isFetchingLocation} onLoading={setIsFetchingLocation} />

        <PhotoCapture isOnline={isOnline} serialNumber={serialNumber} year={year}
          uploadedPaths={photoPaths} localUris={localPhotoUris} onUploaded={setPhotoPaths} onLocal={setLocalPhotoUris}
          loading={isUploadingPhoto} onLoading={setIsUploadingPhoto} />

        <Text style={[type.sectionLabel, styles.sectionTitle]}>Završne informacije</Text>
        <Field label="Napomena" value={notes} onChangeText={setNotes} placeholder="Opcionalno" multiline />
        {validation.length ? <Panel tone="warning" style={styles.validation}>
          <Text style={type.bodyStrong}>Za potvrdu popunite:</Text>
          <Text style={[type.caption, styles.validationText]}>{validation.join(', ')}</Text>
        </Panel> : null}
        <ActionButton title="Kreiraj zapisnik" icon="checkmark" size="lg" loading={createMutation.isPending}
          disabled={validation.length > 0} onPress={() => createMutation.mutate()} />
        <ActionButton title="Odustani" variant="ghost" onPress={() => router.back()} style={styles.cancel} />
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

function parseOptionalFloat(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  sectionTitle: { marginTop: spacing.xl, marginBottom: spacing.md },
  twoFields: { flexDirection: 'row', gap: spacing.md },
  flexField: { flex: 1 },
  validation: { marginBottom: spacing.lg },
  validationText: { marginTop: spacing.xs },
  cancel: { marginTop: spacing.sm },
});