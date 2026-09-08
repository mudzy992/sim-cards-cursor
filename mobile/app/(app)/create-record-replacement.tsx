/** Zamjena brojila — dvostepeni produkcijski zapisnik. */
import axios from 'axios';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
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

export default function CreateRecordReplacementScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ simCardId?: string | string[] }>();
  const simCardId = (typeof params.simCardId === 'string' ? params.simCardId : params.simCardId?.[0])?.trim() ?? '';
  const user = useAuthStore((state) => state.user);
  const { isOnline } = useConnectivity();
  const [step, setStep] = useState<1 | 2>(1);

  // Demontirano brojilo
  const [dmMeterTypeId, setDmMeterTypeId] = useState('');
  const [dmSerialNumber, setDmSerialNumber] = useState('');
  const [dmYear, setDmYear] = useState('');
  const [dmCalibrationYear, setDmCalibrationYear] = useState('');
  const [dmDynamic, setDmDynamic] = useState<Record<string, unknown>>({});
  const [dmNotes, setDmNotes] = useState('');
  const [dmHadIntegratedSim, setDmHadIntegratedSim] = useState(false);
  const [dmNoSimNote, setDmNoSimNote] = useState('');

  // Novo brojilo + lokacija
  const [meterTypeId, setMeterTypeId] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [year, setYear] = useState('');
  const [calibrationYear, setCalibrationYear] = useState('');
  const [dynamicValues, setDynamicValues] = useState<Record<string, unknown>>({});
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
  const [clientRequestId] = useState(() => `crid_${Date.now()}_${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    if (user?.role === 'USER' && user.branch?.name) setMunicipality(user.branch.name);
  }, [user?.role, user?.branch?.name]);
  useEffect(() => { setDmDynamic({}); }, [dmMeterTypeId]);
  useEffect(() => { setDynamicValues({}); }, [meterTypeId]);

  const typesQuery = useQuery({ queryKey: ['meter-type-definitions', 'list'], queryFn: () => meterTypeDefinitionsApi.list(), enabled: Boolean(user?.id) });
  const dmFieldsQuery = useQuery({
    queryKey: ['meter-type-definitions', dmMeterTypeId, 'fields', 'replacement-demounted'],
    queryFn: () => meterTypeDefinitionsApi.listFields(dmMeterTypeId), enabled: Boolean(dmMeterTypeId),
  });
  const fieldsQuery = useQuery({
    queryKey: ['meter-type-definitions', meterTypeId, 'fields', 'replacement-new'],
    queryFn: () => meterTypeDefinitionsApi.listFields(meterTypeId), enabled: Boolean(meterTypeId) && step === 2,
  });
  const types = Array.isArray(typesQuery.data) ? typesQuery.data : [];
  const dmFields = Array.isArray(dmFieldsQuery.data) ? dmFieldsQuery.data : [];
  const fields = Array.isArray(fieldsQuery.data) ? fieldsQuery.data : [];
  const typesError = typesQuery.isError || (typesQuery.isFetched && !typesQuery.isLoading && typesQuery.data === undefined);

  const dmValidation = useMemo(() => {
    const missing: string[] = [];
    if (!dmMeterTypeId) missing.push('tip demontiranog brojila');
    if (!dmSerialNumber.trim()) missing.push('serijski broj demontiranog brojila');
    if (!dmYear.trim()) missing.push('godina proizvodnje demontiranog brojila');
    if (!dmCalibrationYear.trim()) missing.push('godina baždarenja demontiranog brojila');
    missing.push(...validateRequiredDynamicFields(dmFields, dmDynamic));
    return missing;
  }, [dmMeterTypeId, dmSerialNumber, dmYear, dmCalibrationYear, dmFields, dmDynamic]);
  const newValidation = useMemo(() => {
    const missing: string[] = [];
    if (!meterTypeId) missing.push('tip novog brojila');
    if (!serialNumber.trim()) missing.push('serijski broj novog brojila');
    if (!year.trim()) missing.push('godina proizvodnje');
    if (!calibrationYear.trim()) missing.push('godina baždarenja');
    missing.push(...validateRequiredDynamicFields(fields, dynamicValues));
    return missing;
  }, [meterTypeId, serialNumber, year, calibrationYear, fields, dynamicValues]);

  const nextStep = () => {
    if (dmValidation.length) { Alert.alert('Nedostaju podaci', dmValidation.join(', ')); return; }
    setStep(2);
  };

  const buildPayload = (): CreateInstallationRecordPayload & { localPhotoUris?: string[] } => {
    if (!user?.id || !simCardId) throw new Error('Nedostaje korisnik ili SIM kartica.');
    if (dmValidation.length || newValidation.length) throw new Error(`Obavezna polja: ${[...dmValidation, ...newValidation].join(', ')}`);
    const dmYearNumber = Number.parseInt(dmYear, 10);
    const dmCalibrationNumber = Number.parseInt(dmCalibrationYear, 10);
    const yearNumber = Number.parseInt(year, 10);
    const calibrationNumber = Number.parseInt(calibrationYear, 10);
    if (![dmYearNumber, dmCalibrationNumber, yearNumber, calibrationNumber].every(Number.isFinite)) throw new Error('Godine moraju biti cijeli brojevi.');
    return {
      kind: 'METER_REPLACEMENT',
      simCardId,
      installedById: user.id,
      clientRequestId,
      meterTypeDefinitionId: meterTypeId,
      serialNumber: serialNumber.trim(),
      year: yearNumber,
      calibrationYear: calibrationNumber,
      demountedMeter: {
        meterTypeDefinitionId: dmMeterTypeId,
        serialNumber: dmSerialNumber.trim(),
        year: dmYearNumber,
        calibrationYear: dmCalibrationNumber,
        dynamicFieldValues: Object.keys(dmDynamic).length ? dmDynamic : undefined,
        notes: dmNotes.trim() || undefined,
        hadIntegratedSim: dmHadIntegratedSim,
        noSimNote: dmNoSimNote.trim() || undefined,
      },
      installationAddress: installationAddress.trim() || undefined,
      installationDate: installationDate || undefined,
      city: city.trim() || undefined,
      municipality: municipality.trim() || undefined,
      branchId: user.branch?.id,
      measuringPoint: measuringPoint.trim() || undefined,
      latitude: parseOptionalFloat(latitude),
      longitude: parseOptionalFloat(longitude),
      dynamicFieldValues: Object.keys(dynamicValues).length ? dynamicValues : undefined,
      notes: notes.trim() || undefined,
      photos: photoPaths.length ? photoPaths : undefined,
      ...(localPhotoUris.length ? { localPhotoUris } : {}),
    };
  };

  const createMutation = useMutation({
    mutationFn: () => installationRecordsApi.create(buildPayload()),
    onSuccess: (created) => {
      if (created?.status === 'SEND_FAILED') {
        Alert.alert('Zapisnik je kreiran', 'Slanje emaila nije uspjelo. Pokušajte ponovo iz detalja.', [
          { text: 'Detalji', onPress: () => router.replace({ pathname: '/(app)/record-details', params: { id: created.id } }) },
          { text: 'Kasnije', onPress: () => router.replace('/(app)/(tabs)/records') },
        ]);
        return;
      }
      Alert.alert('Uspjeh', 'Zapisnik o zamjeni je kreiran i poslan na email.', [
        { text: 'OK', onPress: () => router.replace('/(app)/(tabs)/records') },
      ]);
    },
    onError: async (error) => {
      if (axios.isAxiosError(error) && !error.response) {
        try {
          await queueInstallationRecord(buildPayload());
          Alert.alert('Sačuvano offline', 'Zapisnik o zamjeni bit će poslan kada se veza uspostavi.', [
            { text: 'OK', onPress: () => router.replace('/(app)/(tabs)/records') },
          ]);
          return;
        } catch { /* standardna poruka ispod */ }
      }
      const message = axios.isAxiosError(error) && typeof error.response?.data?.message === 'string'
        ? error.response.data.message : error instanceof Error ? error.message : 'Kreiranje zapisnika nije uspjelo.';
      Alert.alert('Greška', message);
    },
  });

  if (!simCardId) return <SafeAreaView style={styles.root} edges={['top']}>
    <ScreenTitleBar title="Zamjena brojila" />
    <EmptyState icon="alert-circle-outline" title="Nedostaje SIM kartica"
      description="Vratite se na skeniranje i odaberite zamjenu brojila."
      actionLabel="Nazad" onAction={() => router.back()} />
  </SafeAreaView>;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenTitleBar title="Zamjena brojila" subtitle={`Korak ${step} od 2`} />
      <KeyboardAwareScrollView contentContainerStyle={styles.content} bottomOffset={24} keyboardShouldPersistTaps="handled">
        <WorkflowSteps header="ZAMJENA · VOĐENI POSTUPAK" steps={[
          { key: 'old', label: 'Demontirano brojilo', state: step === 2 ? 'done' : 'current', detail: dmSerialNumber || undefined },
          { key: 'new', label: 'Novo brojilo i lokacija', state: step === 2 ? 'current' : 'pending', detail: serialNumber || undefined },
          { key: 'sim', label: 'SIM kartica', state: 'done', detail: simCardId },
          { key: 'confirm', label: 'Potvrda', state: step === 2 && !newValidation.length ? 'current' : 'pending' },
        ]} />

        {step === 1 ? <>
          <Text style={[type.sectionLabel, styles.sectionTitle]}>Demontirano brojilo</Text>
          <MeterTypePicker label="Tip demontiranog brojila" items={types} value={dmMeterTypeId}
            onChange={setDmMeterTypeId} loading={typesQuery.isLoading} error={typesError} />
          <Field label="Serijski broj demontiranog" required value={dmSerialNumber} onChangeText={setDmSerialNumber} autoCapitalize="characters" />
          <Field label="Godina proizvodnje" required value={dmYear} onChangeText={(v) => setDmYear(v.replace(/\D/g, ''))} keyboardType="number-pad" />
          <Field label="Godina baždarenja" required value={dmCalibrationYear} onChangeText={(v) => setDmCalibrationYear(v.replace(/\D/g, ''))} keyboardType="number-pad" />
          {dmMeterTypeId ? <DynamicMeterFields fields={dmFields} values={dmDynamic}
            loading={dmFieldsQuery.isLoading} error={dmFieldsQuery.isError}
            onChange={(name, value) => setDmDynamic((current) => ({ ...current, [name]: value }))} /> : null}
          <Panel style={styles.switchPanel}>
            <View style={styles.switchRow}><View style={styles.switchBody}>
              <Text style={type.bodyStrong}>Staro brojilo ima integrisanu SIM</Text>
              <Text style={[type.caption, styles.switchHint]}>Označite kada se SIM ne može fizički izvaditi.</Text>
            </View><Switch value={dmHadIntegratedSim} onValueChange={setDmHadIntegratedSim}
              trackColor={{ false: palette.borderStrong, true: palette.brandSoftStrong }} thumbColor={dmHadIntegratedSim ? palette.brand : palette.surface} /></View>
          </Panel>
          <Field label="Napomena o SIM-u na starom brojilu" value={dmNoSimNote} onChangeText={setDmNoSimNote} multiline />
          <Field label="Napomena o demontiranom brojilu" value={dmNotes} onChangeText={setDmNotes} multiline />
          {dmValidation.length ? <Panel tone="warning" style={styles.validation}><Text style={type.caption}>{dmValidation.join(', ')}</Text></Panel> : null}
          <ActionButton title="Dalje · novo brojilo" icon="arrow-forward" size="lg" disabled={dmValidation.length > 0} onPress={nextStep} />
          <ActionButton title="Odustani" variant="ghost" onPress={() => router.back()} style={styles.secondary} />
        </> : <>
          <ActionButton title="Nazad na demontirano brojilo" icon="arrow-back" variant="ghost" onPress={() => setStep(1)} style={styles.back} />
          <Text style={[type.sectionLabel, styles.sectionTitle]}>Novo brojilo</Text>
          <MeterTypePicker label="Tip novog brojila" items={types} value={meterTypeId}
            onChange={setMeterTypeId} loading={typesQuery.isLoading} error={typesError} />
          <Field label="Serijski broj novog brojila" required value={serialNumber} onChangeText={setSerialNumber} autoCapitalize="characters" />
          <Field label="Godina proizvodnje" required value={year} onChangeText={(v) => setYear(v.replace(/\D/g, ''))} keyboardType="number-pad" />
          <Field label="Godina baždarenja" required value={calibrationYear} onChangeText={(v) => setCalibrationYear(v.replace(/\D/g, ''))} keyboardType="number-pad" />
          {meterTypeId ? <DynamicMeterFields fields={fields} values={dynamicValues}
            loading={fieldsQuery.isLoading} error={fieldsQuery.isError}
            onChange={(name, value) => setDynamicValues((current) => ({ ...current, [name]: value }))} /> : null}
          <Text style={[type.sectionLabel, styles.sectionTitle]}>Nova lokacija</Text>
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
          <Field label="Napomena" value={notes} onChangeText={setNotes} multiline />
          {newValidation.length ? <Panel tone="warning" style={styles.validation}><Text style={type.caption}>{newValidation.join(', ')}</Text></Panel> : null}
          <ActionButton title="Kreiraj zapisnik zamjene" icon="checkmark" size="lg"
            loading={createMutation.isPending} disabled={newValidation.length > 0} onPress={() => createMutation.mutate()} />
          <ActionButton title="Odustani" variant="ghost" onPress={() => router.back()} style={styles.secondary} />
        </>}
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
  switchPanel: { marginBottom: spacing.lg },
  switchRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  switchBody: { flex: 1 },
  switchHint: { marginTop: spacing.xs },
  validation: { marginBottom: spacing.lg },
  secondary: { marginTop: spacing.sm },
  back: { alignSelf: 'flex-start' },
});