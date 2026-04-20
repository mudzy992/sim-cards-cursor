import axios from 'axios';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { installationRecordsApi, queueInstallationRecord, type CreateInstallationRecordPayload } from '@/api/installation-records.api';
import { meterTypeDefinitionsApi, type MeterTypeFieldItem } from '@/api/meter-type-definitions.api';
import { useAuthStore } from '@/store/auth.store';
import { useConnectivity } from '@/hooks/useConnectivity'
import { colors } from '@/theme/colors';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import { ScreenHeader } from '@/components/common/ScreenHeader'
import { Card } from '@/components/common/Card'

export default function CreateRecordReplacementScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ simCardId?: string }>();
  const simCardId = params.simCardId?.trim() ?? '';
  const userId = useAuthStore((state) => state.user?.id);
  const userBranch = useAuthStore((state) => state.user?.branch);
  const userRole = useAuthStore((state) => state.user?.role);
  const { isOnline } = useConnectivity();
  const [step, setStep] = useState<1 | 2>(1);

  const [dmMeterTypeId, setDmMeterTypeId] = useState('');
  const [dmSerialNumber, setDmSerialNumber] = useState('');
  const [dmYear, setDmYear] = useState('');
  const [dmCalibrationYear, setDmCalibrationYear] = useState('');
  const [dmDynamicFieldValues, setDmDynamicFieldValues] = useState<Record<string, unknown>>({});
  const [dmNotes, setDmNotes] = useState('');
  const [dmHadIntegratedSim, setDmHadIntegratedSim] = useState(false);
  const [dmNoSimNote, setDmNoSimNote] = useState('');

  const [meterTypeId, setMeterTypeId] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [year, setYear] = useState('');
  const [calibrationYear, setCalibrationYear] = useState('');
  const [installationAddress, setInstallationAddress] = useState('');
  const [city, setCity] = useState('');
  const [municipality, setMunicipality] = useState('');

  useEffect(() => {
    if (userRole === 'USER' && userBranch?.name) {
      setMunicipality(userBranch.name);
    }
  }, [userRole, userBranch?.name]);
  const [measuringPoint, setMeasuringPoint] = useState('');
  const [installationDate, setInstallationDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [notes, setNotes] = useState('');
  const [photoPaths, setPhotoPaths] = useState<string[]>([]);
  const [localPhotoUris, setLocalPhotoUris] = useState<string[]>([])
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [dynamicFieldValues, setDynamicFieldValues] = useState<Record<string, unknown>>({});
  const [clientRequestId] = useState(
    () => `crid_${Date.now()}_${Math.random().toString(36).slice(2)}`,
  )

  const meterTypeFieldsQuery = useQuery({
    queryKey: ['meter-type-definitions', meterTypeId, 'fields'],
    queryFn: () => meterTypeDefinitionsApi.listFields(meterTypeId),
    enabled: Boolean(meterTypeId) && step === 2,
  });

  const dmMeterTypeFieldsQuery = useQuery({
    queryKey: ['meter-type-definitions', dmMeterTypeId, 'fields', 'dm'],
    queryFn: () => meterTypeDefinitionsApi.listFields(dmMeterTypeId),
    enabled: Boolean(dmMeterTypeId),
  });

  useEffect(() => {
    if (!meterTypeId) return;
    setDynamicFieldValues({});
  }, [meterTypeId]);

  useEffect(() => {
    if (!dmMeterTypeId) return;
    setDmDynamicFieldValues({});
  }, [dmMeterTypeId]);

  const buildPayload = (): CreateInstallationRecordPayload => {
    if (!userId || !simCardId || !meterTypeId || !serialNumber.trim()) {
      throw new Error('Za novo brojilo: tip i serijski broj su obavezni.');
    }

    if (!dmMeterTypeId || !dmSerialNumber.trim()) {
      throw new Error('Demontirano brojilo: tip i serijski broj su obavezni.');
    }

    const dmYearNum = dmYear ? parseInt(dmYear, 10) : NaN;
    const dmCalNum = dmCalibrationYear ? parseInt(dmCalibrationYear, 10) : NaN;
    if (!Number.isFinite(dmYearNum) || !Number.isFinite(dmCalNum)) {
      throw new Error('Za demontirano brojilo unesite godinu proizvodnje i godinu baždarenja.');
    }

    const dmFields = Array.isArray(dmMeterTypeFieldsQuery.data) ? dmMeterTypeFieldsQuery.data : [];
    const dmMissing: string[] = [];
    for (const f of dmFields) {
      if (!f.isOperatorFillable || !f.isRequired) continue;
      const v = dmDynamicFieldValues[f.name];
      const isEmpty =
        v === undefined || v === null || (typeof v === 'string' && v.trim().length === 0);
      if (isEmpty) dmMissing.push(f.label);
    }
    if (dmMissing.length > 0) {
      throw new Error(`Demontirano – obavezna polja: ${dmMissing.join(', ')}`);
    }

    const lat = latitude ? parseFloat(latitude) : undefined;
    const lon = longitude ? parseFloat(longitude) : undefined;
    const yearNum = year ? parseInt(year, 10) : NaN;
    const calibrationNum = calibrationYear ? parseInt(calibrationYear, 10) : NaN;
    if (!Number.isFinite(yearNum) || !Number.isFinite(calibrationNum)) {
      throw new Error('Godina proizvodnje i godina baždarenja su obavezne.');
    }

    const meterFields = Array.isArray(meterTypeFieldsQuery.data)
      ? meterTypeFieldsQuery.data
      : [];

    const missingRequired: string[] = [];
    for (const f of meterFields) {
      if (!f.isOperatorFillable || !f.isRequired) continue;
      const v = dynamicFieldValues[f.name];
      const isEmpty =
        v === undefined ||
        v === null ||
        (typeof v === 'string' && v.trim().length === 0);
      if (isEmpty) missingRequired.push(f.label);
    }
    if (missingRequired.length > 0) {
      throw new Error(`Obavezna polja: ${missingRequired.join(', ')}`);
    }

    return {
      kind: 'METER_REPLACEMENT',
      simCardId,
      installedById: userId,
      clientRequestId,
      meterTypeDefinitionId: meterTypeId,
      serialNumber: serialNumber.trim(),
      year: yearNum,
      calibrationYear: calibrationNum,
      demountedMeter: {
        meterTypeDefinitionId: dmMeterTypeId,
        serialNumber: dmSerialNumber.trim(),
        year: dmYearNum,
        calibrationYear: dmCalNum,
        ...(Object.keys(dmDynamicFieldValues).length > 0
          ? { dynamicFieldValues: dmDynamicFieldValues }
          : {}),
        ...(dmNotes.trim() ? { notes: dmNotes.trim() } : {}),
        hadIntegratedSim: dmHadIntegratedSim,
        ...(dmNoSimNote.trim() ? { noSimNote: dmNoSimNote.trim() } : {}),
      },
      installationAddress: installationAddress.trim() || undefined,
      installationDate: installationDate || undefined,
      city: city.trim() || undefined,
      municipality: municipality.trim() || undefined,
      branchId: userBranch?.id,
      measuringPoint: measuringPoint.trim() || undefined,
      latitude: Number.isFinite(lat) ? lat : undefined,
      longitude: Number.isFinite(lon) ? lon : undefined,
      dynamicFieldValues: Object.keys(dynamicFieldValues).length > 0 ? dynamicFieldValues : undefined,
      notes: notes.trim() || undefined,
      photos: photoPaths.length > 0 ? photoPaths : undefined,
      ...(localPhotoUris.length > 0 ? { localPhotoUris } : {}),
    };
  };

  const meterTypesQuery = useQuery({
    queryKey: ['meter-type-definitions', 'list'],
    queryFn: () => meterTypeDefinitionsApi.list(),
    enabled: Boolean(userId),
  });

  const createMutation = useMutation({
    mutationFn: () => installationRecordsApi.create(buildPayload()),
    onSuccess: (created) => {
      if (created?.status === 'SEND_FAILED') {
        Alert.alert(
          'Upozorenje',
          'Zapisnik je kreiran, ali slanje emaila nije uspjelo. Otvorite detalje i pokušajte ponovo.',
          [
            {
              text: 'Detalji',
              onPress: () =>
                router.replace({
                  pathname: '/(app)/record-details',
                  params: { id: created.id },
                }),
            },
            { text: 'OK', onPress: () => router.replace('/(app)/(tabs)/records') },
          ],
        );
        return;
      }
      Alert.alert('Uspjeh', 'Zapisnik o zamjeni brojila kreiran i poslan na email.', [
        { text: 'OK', onPress: () => router.replace('/(app)/(tabs)/records') },
      ]);
    },
    onError: async (err) => {
      if (axios.isAxiosError(err) && !err.response) {
        try {
          await queueInstallationRecord(buildPayload());
          Alert.alert(
            'Offline režim',
            'Nema mreže. Zapisnik o zamjeni je sačuvan lokalno i biće automatski poslan kada se veza uspostavi.',
            [{ text: 'OK', onPress: () => router.replace('/(app)/(tabs)/records') }],
          );
          return;
        } catch {
          // ako čuvanje u lokalni queue padne, padamo na standardnu poruku
        }
      }

      const msg =
        axios.isAxiosError(err) && typeof err.response?.data?.message === 'string'
          ? err.response.data.message
          : 'Kreiranje zapisnika nije uspjelo.';
      Alert.alert('Greška', msg);
    },
  });

  const meterTypeOptions = Array.isArray(meterTypesQuery.data) ? meterTypesQuery.data : [];
  const canSubmit = Boolean(
    step === 2 && simCardId && meterTypeId && serialNumber.trim() && userId,
  );

  const handleStep1Next = () => {
    if (!dmMeterTypeId || !dmSerialNumber.trim()) {
      Alert.alert('Greška', 'Odaberite tip i unesite serijski broj demontiranog brojila.');
      return;
    }
    const y = dmYear ? parseInt(dmYear, 10) : NaN;
    const c = dmCalibrationYear ? parseInt(dmCalibrationYear, 10) : NaN;
    if (!Number.isFinite(y) || !Number.isFinite(c)) {
      Alert.alert('Greška', 'Unesite godinu proizvodnje i godinu baždarenja za demontirano brojilo.');
      return;
    }
    const dmFields = Array.isArray(dmMeterTypeFieldsQuery.data) ? dmMeterTypeFieldsQuery.data : [];
    const missing: string[] = [];
    for (const f of dmFields) {
      if (!f.isOperatorFillable || !f.isRequired) continue;
      const v = dmDynamicFieldValues[f.name];
      const isEmpty =
        v === undefined || v === null || (typeof v === 'string' && v.trim().length === 0);
      if (isEmpty) missing.push(f.label);
    }
    if (missing.length > 0) {
      Alert.alert('Greška', `Obavezna polja (demontirano): ${missing.join(', ')}`);
      return;
    }
    setStep(2);
  };
  const typesError =
    meterTypesQuery.isError ||
    (meterTypesQuery.data === undefined &&
      !meterTypesQuery.isLoading &&
      meterTypesQuery.isFetched);

  if (!simCardId) {
    return (
      <View style={{ flex: 1, padding: 16, justifyContent: 'center' }}>
        <Text style={{ color: '#dc2626' }}>
          Nedostaje SIM kartica. Vratite se na sken i zadužite karticu, zatim
          odaberite "Kreiraj zapisnik".
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={{
            marginTop: 16,
            backgroundColor: colors.primary,
            padding: 12,
            borderRadius: 8,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#fff' }}>Natrag</Text>
        </Pressable>
      </View>
    );
  }

  type MeterFieldsQueryState = {
    data: MeterTypeFieldItem[] | undefined;
    isLoading: boolean;
    isError: boolean;
  };

  const renderDynamicFieldsBlock = (
    fieldsQuery: MeterFieldsQueryState,
    values: Record<string, unknown>,
    setValues: (v: React.SetStateAction<Record<string, unknown>>) => void,
    typeId: string,
  ) => {
    if (!typeId) return null;
    return (
      <Card style={{ padding: 12, gap: 10 }}>
        <Text style={{ fontWeight: '800', color: colors.text }}>Dodatna polja</Text>
        {fieldsQuery.isLoading ? (
          <View style={{ paddingVertical: 8 }}>
            <ActivityIndicator size="small" />
          </View>
        ) : fieldsQuery.isError ? (
          <Text style={{ color: '#dc2626' }}>Nije moguće učitati dodatna polja za odabrani tip brojila.</Text>
        ) : (
          (() => {
            const fields = Array.isArray(fieldsQuery.data) ? fieldsQuery.data : [];
            if (fields.length === 0) {
              return <Text style={{ color: colors.textMuted }}>Nema dodatnih polja.</Text>;
            }
            const renderField = (f: MeterTypeFieldItem) => {
              const requiredMark = f.isRequired ? ' *' : '';
              const current = values[f.name];
              if (!f.isOperatorFillable) {
                return (
                  <View key={f.id} style={{ gap: 4 }}>
                    <Text style={{ fontWeight: '600' }}>{f.label}</Text>
                    <Text style={{ color: '#64748b' }}>{f.defaultValue ?? '—'}</Text>
                  </View>
                );
              }
              if (f.fieldType === 'BOOLEAN') {
                const boolValue = current === true || current === 'true';
                return (
                  <View
                    key={f.id}
                    style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <Text style={{ fontWeight: '600' }}>
                      {f.label}
                      {requiredMark}
                    </Text>
                    <Switch
                      value={boolValue}
                      onValueChange={(v) => setValues((prev) => ({ ...prev, [f.name]: v }))}
                    />
                  </View>
                );
              }
              const textValue =
                typeof current === 'string' || typeof current === 'number' ? String(current) : '';
              return (
                <View key={f.id} style={{ gap: 4 }}>
                  <Text style={{ fontWeight: '600' }}>
                    {f.label}
                    {requiredMark}
                  </Text>
                  <TextInput
                    value={textValue}
                    onChangeText={(v) => {
                      if (f.fieldType === 'NUMBER') {
                        const normalized = v.replace(',', '.');
                        const num = normalized.length > 0 ? Number(normalized) : undefined;
                        setValues((prev) => ({
                          ...prev,
                          [f.name]: Number.isFinite(num) ? num : v,
                        }));
                        return;
                      }
                      setValues((prev) => ({ ...prev, [f.name]: v }));
                    }}
                    placeholder={f.fieldType === 'DATE' ? 'YYYY-MM-DD' : ''}
                    keyboardType={f.fieldType === 'NUMBER' ? 'decimal-pad' : 'default'}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 12,
                      padding: 12,
                      fontSize: 16,
                      backgroundColor: colors.surface,
                    }}
                  />
                </View>
              );
            };
            return (
              <View style={{ gap: 12 }}>
                {fields
                  .slice()
                  .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                  .map(renderField)}
              </View>
            );
          })()
        )}
      </Card>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title={step === 1 ? 'Zamjena brojila – korak 1' : 'Zamjena brojila – korak 2'}
        subtitle={
          step === 1
            ? 'Unesite podatke o demontiranom brojilu.'
            : 'Unesite podatke o novom brojilu i lokaciji (SIM je već zadužen).'
        }
      />
      <KeyboardAwareScrollView
        bottomOffset={62}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 24, gap: 12 }}
        keyboardShouldPersistTaps="handled"
      >
        {step === 1 ? (
          <>
            <View>
              <Text style={{ marginBottom: 4, fontWeight: '600' }}>Tip demontiranog brojila *</Text>
              <View style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, minHeight: 52 }}>
                {meterTypesQuery.isLoading ? (
                  <View style={{ padding: 12 }}>
                    <ActivityIndicator size="small" />
                  </View>
                ) : typesError ? (
                  <View style={{ padding: 12 }}>
                    <Text style={{ color: '#dc2626', fontSize: 14 }}>
                      Nije moguće učitati tipove brojila. Provjerite mrežu i pokušajte ponovo.
                    </Text>
                  </View>
                ) : meterTypeOptions.length === 0 ? (
                  <View style={{ padding: 12 }}>
                    <Text style={{ color: '#64748b', fontSize: 14 }}>
                      Nema definisanih tipova brojila. Administrator ih dodaje u aplikaciji.
                    </Text>
                  </View>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingVertical: 8, paddingHorizontal: 4 }}
                  >
                    {meterTypeOptions.map((t) => (
                      <Pressable
                        key={t.id}
                        onPress={() => setDmMeterTypeId(t.id)}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 12,
                          marginHorizontal: 4,
                          borderRadius: 8,
                          backgroundColor: dmMeterTypeId === t.id ? colors.primary : colors.surfaceMuted,
                        }}
                      >
                        <Text
                          style={{
                            color: dmMeterTypeId === t.id ? '#fff' : '#334155',
                            fontWeight: dmMeterTypeId === t.id ? '700' : '400',
                            fontSize: 15,
                          }}
                        >
                          {t.name}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                )}
              </View>
            </View>
            <View>
              <Text style={{ marginBottom: 4, fontWeight: '600' }}>Serijski broj demontiranog *</Text>
              <TextInput
                value={dmSerialNumber}
                onChangeText={setDmSerialNumber}
                placeholder="Serijski broj sa brojila koje se demontira"
                keyboardType="number-pad"
                inputMode="numeric"
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  padding: 12,
                  fontSize: 16,
                  backgroundColor: colors.surface,
                }}
              />
            </View>
            {dmMeterTypeId
              ? renderDynamicFieldsBlock(
                  {
                    data: dmMeterTypeFieldsQuery.data,
                    isLoading: dmMeterTypeFieldsQuery.isLoading,
                    isError: dmMeterTypeFieldsQuery.isError,
                  },
                  dmDynamicFieldValues,
                  setDmDynamicFieldValues,
                  dmMeterTypeId,
                )
              : null}
            <View>
              <Text style={{ marginBottom: 4, fontWeight: '600' }}>Godina proizvodnje (demontirano) *</Text>
              <TextInput
                value={dmYear}
                onChangeText={setDmYear}
                placeholder="npr. 2018"
                keyboardType="number-pad"
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  padding: 12,
                  fontSize: 16,
                  backgroundColor: colors.surface,
                }}
              />
            </View>
            <View>
              <Text style={{ marginBottom: 4, fontWeight: '600' }}>Godina baždarenja (demontirano) *</Text>
              <TextInput
                value={dmCalibrationYear}
                onChangeText={setDmCalibrationYear}
                placeholder="npr. 2024"
                keyboardType="number-pad"
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  padding: 12,
                  fontSize: 16,
                  backgroundColor: colors.surface,
                }}
              />
            </View>
            <View>
              <Text style={{ marginBottom: 4, fontWeight: '600' }}>Napomena (demontirano brojilo)</Text>
              <TextInput
                value={dmNotes}
                onChangeText={setDmNotes}
                placeholder="Opcionalno"
                multiline
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  padding: 12,
                  fontSize: 16,
                  minHeight: 60,
                  backgroundColor: colors.surface,
                }}
              />
            </View>
            <View
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <Text style={{ fontWeight: '600', flex: 1, paddingRight: 12 }}>
                Staro brojilo ima ugrađenu SIM karticu
              </Text>
              <Switch value={dmHadIntegratedSim} onValueChange={setDmHadIntegratedSim} />
            </View>
            <View>
              <Text style={{ marginBottom: 4, fontWeight: '600' }}>Napomena (SIM na starom brojilu)</Text>
              <TextInput
                value={dmNoSimNote}
                onChangeText={setDmNoSimNote}
                placeholder="Opcionalno – npr. nema ugrađene SIM"
                multiline
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  padding: 12,
                  fontSize: 16,
                  minHeight: 52,
                  backgroundColor: colors.surface,
                }}
              />
            </View>
            <Pressable
              onPress={handleStep1Next}
              style={{
                backgroundColor: colors.primary,
                padding: 14,
                borderRadius: 10,
                alignItems: 'center',
                marginTop: 8,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>Dalje – novo brojilo</Text>
            </Pressable>
            <Pressable
              onPress={() => router.back()}
              style={{
                padding: 14,
                borderRadius: 10,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: '#e2e8f0',
              }}
            >
              <Text style={{ color: '#64748b' }}>Odustani</Text>
            </Pressable>
          </>
        ) : (
          <>
      <View>
        <Text style={{ marginBottom: 4, fontWeight: '600' }}>Tip novog brojila *</Text>
        <View style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, minHeight: 52 }}>
          {meterTypesQuery.isLoading ? (
            <View style={{ padding: 12 }}>
              <ActivityIndicator size="small" />
            </View>
          ) : typesError ? (
            <View style={{ padding: 12 }}>
              <Text style={{ color: '#dc2626', fontSize: 14 }}>
                Nije moguće učitati tipove brojila. Provjerite mrežu i pokušajte ponovo.
              </Text>
            </View>
          ) : meterTypeOptions.length === 0 ? (
            <View style={{ padding: 12 }}>
              <Text style={{ color: '#64748b', fontSize: 14 }}>
                Nema definisanih tipova brojila. Administrator ih dodaje u aplikaciji.
              </Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 8, paddingHorizontal: 4 }}
            >
              {meterTypeOptions.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => setMeterTypeId(t.id)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    marginHorizontal: 4,
                    borderRadius: 8,
                    backgroundColor: meterTypeId === t.id ? colors.primary : colors.surfaceMuted,
                  }}
                >
                  <Text
                    style={{
                      color: meterTypeId === t.id ? '#fff' : '#334155',
                      fontWeight: meterTypeId === t.id ? '700' : '400',
                      fontSize: 15,
                    }}
                  >
                    {t.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      </View>

      <View>
        <Text style={{ marginBottom: 4, fontWeight: '600' }}>Serijski broj novog brojila *</Text>
        <TextInput
          value={serialNumber}
          onChangeText={setSerialNumber}
          placeholder="Unesite serijski broj s brojila"
          keyboardType="number-pad"
          inputMode="numeric"
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            padding: 12,
            fontSize: 16,
            backgroundColor: colors.surface,
          }}
        />
      </View>

      {meterTypeId
        ? renderDynamicFieldsBlock(
            {
              data: meterTypeFieldsQuery.data,
              isLoading: meterTypeFieldsQuery.isLoading,
              isError: meterTypeFieldsQuery.isError,
            },
            dynamicFieldValues,
            setDynamicFieldValues,
            meterTypeId,
          )
        : null}

      <View>
        <Text style={{ marginBottom: 4, fontWeight: '600' }}>Godina proizvodnje *</Text>
        <TextInput
          value={year}
          onChangeText={setYear}
          placeholder="npr. 2024"
          keyboardType="number-pad"
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            padding: 12,
            fontSize: 16,
            backgroundColor: colors.surface,
          }}
        />
      </View>

      <View>
        <Text style={{ marginBottom: 4, fontWeight: '600' }}>Godina baždarenja *</Text>
        <TextInput
          value={calibrationYear}
          onChangeText={setCalibrationYear}
          placeholder="npr. 2025"
          keyboardType="number-pad"
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            padding: 12,
            fontSize: 16,
            backgroundColor: colors.surface,
          }}
        />
      </View>

      <View>
        <Text style={{ marginBottom: 4, fontWeight: '600' }}>Adresa instalacije</Text>
        <TextInput
          value={installationAddress}
          onChangeText={setInstallationAddress}
          placeholder="Ulica, broj, mjesto"
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            padding: 12,
            fontSize: 16,
            backgroundColor: colors.surface,
          }}
        />
      </View>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ marginBottom: 4, fontWeight: '600' }}>Grad</Text>
          <TextInput
            value={city}
            onChangeText={setCity}
            placeholder="Grad"
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              padding: 12,
              fontSize: 16,
              backgroundColor: colors.surface,
            }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ marginBottom: 4, fontWeight: '600' }}>Opština</Text>
          <TextInput
            value={municipality}
            onChangeText={setMunicipality}
            placeholder="Opština"
            editable={userRole !== 'USER'}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              padding: 12,
              fontSize: 16,
              backgroundColor: userRole === 'USER' ? colors.surfaceMuted : colors.surface,
            }}
          />
        </View>
      </View>

      <View>
        <Text style={{ marginBottom: 4, fontWeight: '600' }}>Mjerno mjesto</Text>
        <TextInput
          value={measuringPoint}
          onChangeText={setMeasuringPoint}
          placeholder="Opcionalno"
          keyboardType="number-pad"
          inputMode="numeric"
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            padding: 12,
            fontSize: 16,
            backgroundColor: colors.surface,
          }}
        />
      </View>

      <View>
        <Text style={{ marginBottom: 4, fontWeight: '600' }}>Datum instalacije</Text>
        <TextInput
          value={installationDate}
          onChangeText={setInstallationDate}
          placeholder="YYYY-MM-DD"
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            padding: 12,
            fontSize: 16,
            backgroundColor: colors.surface,
          }}
        />
      </View>

      <View>
        <Text style={{ marginBottom: 4, fontWeight: '600' }}>
          GPS lokacija (preporučeno – automatski dohvat)
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 2 }}>Širina</Text>
            <TextInput
              value={latitude}
              onChangeText={setLatitude}
              placeholder="npr. 43.85"
              keyboardType="decimal-pad"
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                padding: 12,
                fontSize: 16,
                backgroundColor: colors.surface,
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 2 }}>Dužina</Text>
            <TextInput
              value={longitude}
              onChangeText={setLongitude}
              placeholder="npr. 18.41"
              keyboardType="decimal-pad"
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                padding: 12,
                fontSize: 16,
                backgroundColor: colors.surface,
              }}
            />
          </View>
          <Pressable
            onPress={async () => {
              setIsFetchingLocation(true);
              try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                  Alert.alert(
                    'Dozvola za lokaciju',
                    'Za automatski unos GPS koordinata potrebna je dozvola za lokaciju. Omogućite je u postavkama uređaja.',
                    [{ text: 'OK' }],
                  );
                  return;
                }
                const loc = await Location.getCurrentPositionAsync({
                  accuracy: Location.Accuracy.Balanced,
                });
                setLatitude(loc.coords.latitude.toFixed(6));
                setLongitude(loc.coords.longitude.toFixed(6));
              } catch (err) {
                Alert.alert(
                  'Greška',
                  'Nije moguće dohvatiti lokaciju. Provjerite da je GPS uključen.',
                  [{ text: 'OK' }],
                );
              } finally {
                setIsFetchingLocation(false);
              }
            }}
            disabled={isFetchingLocation}
            style={{
              backgroundColor: colors.primary,
              paddingHorizontal: 14,
              paddingVertical: 12,
              borderRadius: 8,
              justifyContent: 'center',
              minHeight: 48,
            }}
          >
            {isFetchingLocation ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="locate" size={20} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>
                  Dohvati
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      <View>
        <Text style={{ marginBottom: 4, fontWeight: '600' }}>Fotografije (opcionalno)</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <Pressable
            onPress={async () => {
              const { status } = await ImagePicker.requestCameraPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert(
                  'Dozvola za kameru',
                  'Za snimanje fotografija potrebna je dozvola za kameru.',
                  [{ text: 'OK' }],
                );
                return;
              }
              const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ['images'],
                allowsEditing: false,
                quality: 0.8,
              });
              if (result.canceled || !result.assets[0]?.uri) return;
              setIsUploadingPhoto(true);
              try {
                if (!isOnline) {
                  setLocalPhotoUris((p) => [...p, result.assets[0].uri])
                  return
                }
                const path = await installationRecordsApi.uploadPhoto(result.assets[0].uri);
                setPhotoPaths((p) => [...p, path]);
              } catch (err) {
                if (axios.isAxiosError(err) && !err.response) {
                  setLocalPhotoUris((p) => [...p, result.assets[0].uri])
                  return
                }
                Alert.alert(
                  'Greška',
                  axios.isAxiosError(err) && typeof err.response?.data?.message === 'string'
                    ? err.response.data.message
                    : 'Upload fotografije nije uspio.',
                  [{ text: 'OK' }],
                );
              } finally {
                setIsUploadingPhoto(false);
              }
            }}
            disabled={isUploadingPhoto}
            style={{
              backgroundColor: '#f1f5f9',
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: '#e2e8f0',
              borderStyle: 'dashed',
            }}
          >
            {isUploadingPhoto ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="camera" size={24} color={colors.primary} />
                <Text style={{ color: colors.primary, fontWeight: '600' }}>Dodaj fotografiju</Text>
              </View>
            )}
          </Pressable>
          {photoPaths.length > 0 && (
            <Text style={{ color: '#64748b', fontSize: 14 }}>
              Dodano: {photoPaths.length}
            </Text>
          )}
          {localPhotoUris.length > 0 && (
            <Text style={{ color: '#b45309', fontSize: 14 }}>
              Na čekanju (offline): {localPhotoUris.length}
            </Text>
          )}
        </View>
      </View>

      <View>
        <Text style={{ marginBottom: 4, fontWeight: '600' }}>Napomena</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Opcionalno"
          multiline
          style={{
            borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
            padding: 12,
            fontSize: 16,
            minHeight: 60,
          backgroundColor: colors.surface,
          }}
        />
      </View>

      <Pressable
        onPress={() => setStep(1)}
        style={{
          padding: 14,
          borderRadius: 10,
          alignItems: 'center',
          borderWidth: 1,
          borderColor: colors.border,
          marginTop: 4,
        }}
      >
        <Text style={{ color: colors.text }}>Natrag na demontirano brojilo</Text>
      </Pressable>

      <Pressable
        disabled={!canSubmit || createMutation.isPending}
        onPress={() => createMutation.mutate()}
        style={{
          backgroundColor: !canSubmit ? colors.disabled : colors.primary,
          padding: 14,
          borderRadius: 10,
          alignItems: 'center',
          marginTop: 8,
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '600' }}>
          {createMutation.isPending ? 'Kreiranje...' : 'Kreiraj zapisnik zamjene'}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => router.back()}
        style={{
          padding: 14,
          borderRadius: 10,
          alignItems: 'center',
          borderWidth: 1,
          borderColor: '#e2e8f0',
        }}
      >
        <Text style={{ color: '#64748b' }}>Odustani</Text>
      </Pressable>
          </>
        )}
      </KeyboardAwareScrollView>
    </View>
  );
}
