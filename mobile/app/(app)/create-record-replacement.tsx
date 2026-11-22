/** Zamjena brojila — dvostepeni produkcijski zapisnik sa auto-save nacrtom i skeniranjem serijskog broja. */
import axios from 'axios';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import {
  installationRecordsApi,
  queueInstallationRecord,
  type CreateInstallationRecordPayload,
} from '@/api/installation-records.api';
import { meterTypeDefinitionsApi } from '@/api/meter-type-definitions.api';
import { useAuthStore } from '@/store/auth.store';
import { useConnectivity } from '@/hooks/useConnectivity';
import { useTranslation } from '@/i18n/i18n.store';
import {
  clearRecordDraft,
  hasMeaningfulDraftContent,
  loadRecordDraft,
  saveRecordDraft,
  type RecordFormDraft,
} from '@/offline/draft-store';
import {
  spacing,
  useTheme,
  useThemedStyles,
  type ThemePalette,
} from '@/theme/tokens';
import { ScreenTitleBar } from '@/components/ui/ScreenTitleBar';
import { WorkflowSteps } from '@/components/ui/WorkflowSteps';
import { Field } from '@/components/ui/Field';
import { Panel } from '@/components/ui/Panel';
import { ActionButton } from '@/components/ui/ActionButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { MeterTypePicker } from '@/features/records/MeterTypePicker';
import {
  DynamicMeterFields,
  validateRequiredDynamicFields,
} from '@/features/tasks/DynamicMeterFields';
import { LocationFields } from '@/features/records/LocationFields';
import { PhotoCapture } from '@/features/records/PhotoCapture';
import { hapticError, hapticSuccess } from '@/utils/haptics';

export default function CreateRecordReplacementScreen() {
  const router = useRouter();
  const { palette, type } = useTheme();
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const params = useLocalSearchParams<{
    simCardId?: string | string[];
    pickedSerial?: string | string[];
    pickedSerialTarget?: string | string[];
  }>();
  const simCardId =
    (typeof params.simCardId === 'string'
      ? params.simCardId
      : params.simCardId?.[0]
    )?.trim() ?? '';
  const pickedSerial =
    (typeof params.pickedSerial === 'string'
      ? params.pickedSerial
      : params.pickedSerial?.[0]
    )?.trim() ?? '';
  const pickedSerialTarget =
    (typeof params.pickedSerialTarget === 'string'
      ? params.pickedSerialTarget
      : params.pickedSerialTarget?.[0]
    )?.trim() ?? 'new';
  const user = useAuthStore((state) => state.user);
  const { isOnline } = useConnectivity();
  const [step, setStep] = useState<1 | 2>(1);
  const draftScope = `rep:${simCardId}`;

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
  const [dynamicValues, setDynamicValues] = useState<Record<string, unknown>>(
    {},
  );
  const [installationAddress, setInstallationAddress] = useState('');
  const [city, setCity] = useState('');
  const [municipality, setMunicipality] = useState('');
  const [measuringPoint, setMeasuringPoint] = useState('');
  const [installationDate, setInstallationDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [notes, setNotes] = useState('');
  const [photoPaths, setPhotoPaths] = useState<string[]>([]);
  const [localPhotoUris, setLocalPhotoUris] = useState<string[]>([]);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [clientRequestId] = useState(
    () => `crid_${Date.now()}_${Math.random().toString(36).slice(2)}`,
  );
  const [pendingDraft, setPendingDraft] = useState<RecordFormDraft | null>(
    null,
  );
  const draftCheckedRef = useRef(false);

  useEffect(() => {
    if (user?.role === 'USER' && user.branch?.name) {
      setMunicipality(user.branch.name);
    }
  }, [user?.role, user?.branch?.name]);

  useEffect(() => {
    setDmDynamic({});
  }, [dmMeterTypeId]);
  useEffect(() => {
    setDynamicValues({});
  }, [meterTypeId]);

  useEffect(() => {
    if (!pickedSerial) return;
    if (pickedSerialTarget === 'demounted') {
      setDmSerialNumber(pickedSerial);
    } else {
      setSerialNumber(pickedSerial);
    }
  }, [pickedSerial, pickedSerialTarget]);

  useEffect(() => {
    if (!user || !simCardId || draftCheckedRef.current) return;
    draftCheckedRef.current = true;
    void loadRecordDraft(user, draftScope).then((draft) => {
      if (draft && hasMeaningfulDraftContent(draft)) {
        setPendingDraft(draft);
      }
    });
  }, [user, simCardId, draftScope]);

  useEffect(() => {
    if (!user || !simCardId) return;
    const draftPayload = {
      meterTypeId,
      serialNumber,
      year,
      calibrationYear,
      installationAddress,
      city,
      municipality,
      measuringPoint,
      installationDate,
      latitude,
      longitude,
      notes,
      dynamicFieldValues: {
        ...dynamicValues,
        __dmMeterTypeId: dmMeterTypeId,
        __dmSerialNumber: dmSerialNumber,
        __dmYear: dmYear,
        __dmCalibrationYear: dmCalibrationYear,
      },
    };
    const timer = setTimeout(() => {
      void saveRecordDraft(user, draftScope, draftPayload);
    }, 500);
    return () => clearTimeout(timer);
  }, [
    user,
    simCardId,
    draftScope,
    meterTypeId,
    serialNumber,
    year,
    calibrationYear,
    installationAddress,
    city,
    municipality,
    measuringPoint,
    installationDate,
    latitude,
    longitude,
    notes,
    dynamicValues,
    dmMeterTypeId,
    dmSerialNumber,
    dmYear,
    dmCalibrationYear,
  ]);

  const restoreDraft = () => {
    if (!pendingDraft) return;
    if (pendingDraft.meterTypeId) setMeterTypeId(pendingDraft.meterTypeId);
    if (pendingDraft.serialNumber) setSerialNumber(pendingDraft.serialNumber);
    if (pendingDraft.year) setYear(pendingDraft.year);
    if (pendingDraft.calibrationYear)
      setCalibrationYear(pendingDraft.calibrationYear);
    if (pendingDraft.installationAddress)
      setInstallationAddress(pendingDraft.installationAddress);
    if (pendingDraft.city) setCity(pendingDraft.city);
    if (pendingDraft.municipality) setMunicipality(pendingDraft.municipality);
    if (pendingDraft.measuringPoint)
      setMeasuringPoint(pendingDraft.measuringPoint);
    if (pendingDraft.installationDate)
      setInstallationDate(pendingDraft.installationDate);
    if (pendingDraft.latitude) setLatitude(pendingDraft.latitude);
    if (pendingDraft.longitude) setLongitude(pendingDraft.longitude);
    if (pendingDraft.notes) setNotes(pendingDraft.notes);
    if (pendingDraft.dynamicFieldValues) {
      const {
        __dmMeterTypeId,
        __dmSerialNumber,
        __dmYear,
        __dmCalibrationYear,
        ...rest
      } = pendingDraft.dynamicFieldValues;
      if (typeof __dmMeterTypeId === 'string') setDmMeterTypeId(__dmMeterTypeId);
      if (typeof __dmSerialNumber === 'string')
        setDmSerialNumber(__dmSerialNumber);
      if (typeof __dmYear === 'string') setDmYear(__dmYear);
      if (typeof __dmCalibrationYear === 'string')
        setDmCalibrationYear(__dmCalibrationYear);
      setDynamicValues(rest);
    }
    setPendingDraft(null);
    hapticSuccess();
  };

  const discardDraft = () => {
    setPendingDraft(null);
    if (user && simCardId) {
      void clearRecordDraft(user, draftScope);
    }
  };

  const typesQuery = useQuery({
    queryKey: ['meter-type-definitions', 'list'],
    queryFn: () => meterTypeDefinitionsApi.list(),
    enabled: Boolean(user?.id),
  });
  const dmFieldsQuery = useQuery({
    queryKey: [
      'meter-type-definitions',
      dmMeterTypeId,
      'fields',
      'replacement-demounted',
    ],
    queryFn: () => meterTypeDefinitionsApi.listFields(dmMeterTypeId),
    enabled: Boolean(dmMeterTypeId),
  });
  const fieldsQuery = useQuery({
    queryKey: [
      'meter-type-definitions',
      meterTypeId,
      'fields',
      'replacement-new',
    ],
    queryFn: () => meterTypeDefinitionsApi.listFields(meterTypeId),
    enabled: Boolean(meterTypeId) && step === 2,
  });
  const types = Array.isArray(typesQuery.data) ? typesQuery.data : [];
  const dmFields = useMemo(
    () => (Array.isArray(dmFieldsQuery.data) ? dmFieldsQuery.data : []),
    [dmFieldsQuery.data],
  );
  const fields = useMemo(
    () => (Array.isArray(fieldsQuery.data) ? fieldsQuery.data : []),
    [fieldsQuery.data],
  );
  const typesError =
    typesQuery.isError ||
    (typesQuery.isFetched &&
      !typesQuery.isLoading &&
      typesQuery.data === undefined);

  const dmValidation = useMemo(() => {
    const missing: string[] = [];
    if (!dmMeterTypeId) missing.push(t('mobile.records.form.reqOldMeterType'));
    if (!dmSerialNumber.trim())
      missing.push(t('mobile.records.form.reqOldSerial'));
    if (!dmYear.trim()) missing.push(t('mobile.records.form.reqOldYear'));
    if (!dmCalibrationYear.trim())
      missing.push(t('mobile.records.form.reqOldCalibration'));
    missing.push(...validateRequiredDynamicFields(dmFields, dmDynamic));
    return missing;
  }, [
    dmMeterTypeId,
    dmSerialNumber,
    dmYear,
    dmCalibrationYear,
    dmFields,
    dmDynamic,
    t,
  ]);
  const newValidation = useMemo(() => {
    const missing: string[] = [];
    if (!meterTypeId) missing.push(t('mobile.records.form.reqNewMeterType'));
    if (!serialNumber.trim())
      missing.push(t('mobile.records.form.reqNewSerial'));
    if (!year.trim()) missing.push(t('mobile.records.form.reqYear'));
    if (!calibrationYear.trim())
      missing.push(t('mobile.records.form.reqCalibration'));
    missing.push(...validateRequiredDynamicFields(fields, dynamicValues));
    return missing;
  }, [
    meterTypeId,
    serialNumber,
    year,
    calibrationYear,
    fields,
    dynamicValues,
    t,
  ]);

  const nextStep = () => {
    if (dmValidation.length) {
      hapticError();
      Alert.alert(
        t('mobile.records.form.missingDataTitle'),
        dmValidation.join(', '),
      );
      return;
    }
    setStep(2);
  };

  const buildPayload = (): CreateInstallationRecordPayload & {
    localPhotoUris?: string[];
  } => {
    if (!user?.id || !simCardId) {
      throw new Error(t('mobile.records.form.missingUserOrSim'));
    }
    if (dmValidation.length || newValidation.length) {
      throw new Error(
        `${t('mobile.records.form.validationPrefix')} ${[...dmValidation, ...newValidation].join(', ')}`,
      );
    }
    const dmYearNumber = Number.parseInt(dmYear, 10);
    const dmCalibrationNumber = Number.parseInt(dmCalibrationYear, 10);
    const yearNumber = Number.parseInt(year, 10);
    const calibrationNumber = Number.parseInt(calibrationYear, 10);
    if (
      ![dmYearNumber, dmCalibrationNumber, yearNumber, calibrationNumber].every(
        Number.isFinite,
      )
    ) {
      throw new Error(t('mobile.records.form.yearsMustBeIntegers'));
    }
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
        dynamicFieldValues: Object.keys(dmDynamic).length
          ? dmDynamic
          : undefined,
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
      dynamicFieldValues: Object.keys(dynamicValues).length
        ? dynamicValues
        : undefined,
      notes: notes.trim() || undefined,
      photos: photoPaths.length ? photoPaths : undefined,
      ...(localPhotoUris.length ? { localPhotoUris } : {}),
    };
  };

  const createMutation = useMutation({
    mutationFn: () => installationRecordsApi.create(buildPayload()),
    onSuccess: (created) => {
      if (user && simCardId) void clearRecordDraft(user, draftScope);
      hapticSuccess();
      if (created?.status === 'SEND_FAILED') {
        Alert.alert(
          t('mobile.records.form.createdEmailFailedTitle'),
          t('mobile.records.form.createdEmailFailedMessage'),
          [
            {
              text: t('mobile.records.form.detailsButton'),
              onPress: () =>
                router.replace({
                  pathname: '/(app)/record-details',
                  params: { id: created.id },
                }),
            },
            {
              text: t('mobile.records.form.laterButton'),
              onPress: () => router.replace('/(app)/(tabs)/records'),
            },
          ],
        );
        return;
      }
      Alert.alert(
        t('mobile.common.success'),
        t('mobile.records.form.createdSuccessRep'),
        [
          {
            text: t('mobile.common.ok'),
            onPress: () => router.replace('/(app)/(tabs)/records'),
          },
        ],
      );
    },
    onError: async (error) => {
      if (axios.isAxiosError(error) && !error.response) {
        try {
          await queueInstallationRecord(buildPayload());
          if (user && simCardId) void clearRecordDraft(user, draftScope);
          hapticSuccess();
          Alert.alert(
            t('mobile.records.form.savedOfflineTitle'),
            t('mobile.records.form.savedOfflineRep'),
            [
              {
                text: t('mobile.common.ok'),
                onPress: () => router.replace('/(app)/(tabs)/records'),
              },
            ],
          );
          return;
        } catch {
          /* standardna poruka ispod */
        }
      }
      hapticError();
      const message =
        axios.isAxiosError(error) && typeof error.response?.data?.message === 'string'
          ? error.response.data.message
          : error instanceof Error
            ? error.message
            : t('mobile.records.form.createFailed');
      Alert.alert(t('mobile.common.error'), message);
    },
  });

  if (!simCardId) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <ScreenTitleBar
          title={t('mobile.records.form.replacementTitle')}
          onBack={() => router.back()}
        />
        <EmptyState
          icon="alert-circle-outline"
          title={t('mobile.records.form.missingSimTitle')}
          description={t('mobile.records.form.missingSimRepDesc')}
          actionLabel={t('mobile.common.back')}
          onAction={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenTitleBar
        title={t('mobile.records.form.replacementTitle')}
        subtitle={t('mobile.records.form.replacementSubtitle', { step })}
        onBack={() => router.back()}
      />
      <KeyboardAwareScrollView
        contentContainerStyle={styles.content}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
      >
        {pendingDraft ? (
          <Panel tone="info" style={styles.draftBanner} testID="draft-banner">
            <Text style={type.bodyStrong}>
              {t('mobile.records.form.draftFound')}
            </Text>
            <Text style={[type.caption, styles.draftDesc]}>
              {t('mobile.records.form.draftDesc')}
            </Text>
            <View style={styles.draftActions}>
              <ActionButton
                testID="draft-discard-btn"
                title={t('mobile.records.form.draftDiscard')}
                variant="ghost"
                size="sm"
                fullWidth={false}
                onPress={discardDraft}
              />
              <ActionButton
                testID="draft-restore-btn"
                title={t('mobile.records.form.draftRestore')}
                size="sm"
                fullWidth={false}
                onPress={restoreDraft}
              />
            </View>
          </Panel>
        ) : null}

        <WorkflowSteps
          header={t('mobile.records.form.replacementHeader')}
          steps={[
            {
              key: 'old',
              label: t('mobile.records.form.stepOldMeter'),
              state: step === 2 ? 'done' : 'current',
              detail: dmSerialNumber || undefined,
            },
            {
              key: 'new',
              label: t('mobile.records.form.stepNewMeterLocation'),
              state: step === 2 ? 'current' : 'pending',
              detail: serialNumber || undefined,
            },
            {
              key: 'sim',
              label: t('mobile.records.form.stepSim'),
              state: 'done',
              detail: simCardId,
            },
            {
              key: 'confirm',
              label: t('mobile.records.form.stepConfirm'),
              state: step === 2 && !newValidation.length ? 'current' : 'pending',
            },
          ]}
        />

        {step === 1 ? (
          <>
            <Text style={[type.sectionLabel, styles.sectionTitle]}>
              {t('mobile.records.form.demountedSection')}
            </Text>
            <MeterTypePicker
              label={t('mobile.records.form.demountedTypeLabel')}
              items={types}
              value={dmMeterTypeId}
              onChange={setDmMeterTypeId}
              loading={typesQuery.isLoading}
              error={typesError}
            />
            <Field
              testID="replacement-old-serial-input"
              label={t('mobile.records.form.demountedSerialLabel')}
              required
              value={dmSerialNumber}
              onChangeText={setDmSerialNumber}
              autoCapitalize="characters"
              trailingAction={{
                icon: 'barcode-outline',
                accessibilityLabel: t(
                  'mobile.records.form.scanDemountedAccessibility',
                ),
                onPress: () =>
                  router.push({
                    pathname: '/(app)/(tabs)/scan',
                    params: {
                      afterScan: 'meterSerial',
                      simCardId,
                      serialTarget: 'demounted',
                      returnTo: 'create-record-replacement',
                    },
                  }),
              }}
            />
            <Field
              label={t('mobile.records.form.yearLabel')}
              required
              value={dmYear}
              onChangeText={(v) => setDmYear(v.replace(/\D/g, ''))}
              keyboardType="number-pad"
            />
            <Field
              label={t('mobile.records.form.calibrationLabel')}
              required
              value={dmCalibrationYear}
              onChangeText={(v) => setDmCalibrationYear(v.replace(/\D/g, ''))}
              keyboardType="number-pad"
            />
            {dmMeterTypeId ? (
              <DynamicMeterFields
                fields={dmFields}
                values={dmDynamic}
                loading={dmFieldsQuery.isLoading}
                error={dmFieldsQuery.isError}
                onChange={(name, value) =>
                  setDmDynamic((current) => ({ ...current, [name]: value }))
                }
              />
            ) : null}
            <Panel style={styles.switchPanel}>
              <View style={styles.switchRow}>
                <View style={styles.switchBody}>
                  <Text style={type.bodyStrong}>
                    {t('mobile.records.form.integratedSimTitle')}
                  </Text>
                  <Text style={[type.caption, styles.switchHint]}>
                    {t('mobile.records.form.integratedSimHint')}
                  </Text>
                </View>
                <Switch
                  value={dmHadIntegratedSim}
                  onValueChange={setDmHadIntegratedSim}
                  trackColor={{
                    false: palette.borderStrong,
                    true: palette.brandSoftStrong,
                  }}
                  thumbColor={
                    dmHadIntegratedSim ? palette.brand : palette.surface
                  }
                />
              </View>
            </Panel>
            <Field
              label={t('mobile.records.form.oldMeterSimNote')}
              value={dmNoSimNote}
              onChangeText={setDmNoSimNote}
              multiline
            />
            <Field
              label={t('mobile.records.form.oldMeterNote')}
              value={dmNotes}
              onChangeText={setDmNotes}
              multiline
            />
            {dmValidation.length ? (
              <Panel tone="warning" style={styles.validation}>
                <Text style={type.caption}>{dmValidation.join(', ')}</Text>
              </Panel>
            ) : null}
            <ActionButton
              testID="replacement-next-step-btn"
              title={t('mobile.records.form.nextNewMeter')}
              icon="arrow-forward"
              size="lg"
              disabled={dmValidation.length > 0}
              onPress={nextStep}
            />
            <ActionButton
              title={t('mobile.common.cancel')}
              variant="ghost"
              onPress={() => router.back()}
              style={styles.secondary}
            />
          </>
        ) : (
          <>
            <ActionButton
              title={t('mobile.records.form.backToDemounted')}
              icon="arrow-back"
              variant="ghost"
              onPress={() => setStep(1)}
              style={styles.back}
            />
            <Text style={[type.sectionLabel, styles.sectionTitle]}>
              {t('mobile.records.form.newMeterSection')}
            </Text>
            <MeterTypePicker
              label={t('mobile.records.form.newMeterTypeLabel')}
              items={types}
              value={meterTypeId}
              onChange={setMeterTypeId}
              loading={typesQuery.isLoading}
              error={typesError}
            />
            <Field
              testID="replacement-new-serial-input"
              label={t('mobile.records.form.newMeterSerialLabel')}
              required
              value={serialNumber}
              onChangeText={setSerialNumber}
              autoCapitalize="characters"
              trailingAction={{
                icon: 'barcode-outline',
                accessibilityLabel: t(
                  'mobile.records.form.scanNewSerialAccessibility',
                ),
                onPress: () =>
                  router.push({
                    pathname: '/(app)/(tabs)/scan',
                    params: {
                      afterScan: 'meterSerial',
                      simCardId,
                      serialTarget: 'new',
                      returnTo: 'create-record-replacement',
                    },
                  }),
              }}
            />
            <Field
              label={t('mobile.records.form.yearLabel')}
              required
              value={year}
              onChangeText={(v) => setYear(v.replace(/\D/g, ''))}
              keyboardType="number-pad"
            />
            <Field
              label={t('mobile.records.form.calibrationLabel')}
              required
              value={calibrationYear}
              onChangeText={(v) => setCalibrationYear(v.replace(/\D/g, ''))}
              keyboardType="number-pad"
            />
            {meterTypeId ? (
              <DynamicMeterFields
                fields={fields}
                values={dynamicValues}
                loading={fieldsQuery.isLoading}
                error={fieldsQuery.isError}
                onChange={(name, value) =>
                  setDynamicValues((current) => ({ ...current, [name]: value }))
                }
              />
            ) : null}
            <Text style={[type.sectionLabel, styles.sectionTitle]}>
              {t('mobile.records.form.newLocationSection')}
            </Text>
            <Field
              label={t('mobile.records.form.addressLabel')}
              value={installationAddress}
              onChangeText={setInstallationAddress}
              placeholder={t('mobile.records.form.addressPlaceholder')}
            />
            <Field
              label={t('mobile.records.form.cityLabel')}
              value={city}
              onChangeText={setCity}
            />
            <Field
              label={t('mobile.records.form.municipalityLabel')}
              value={municipality}
              onChangeText={setMunicipality}
            />
            <Field
              label={t('mobile.records.form.measuringPointLabel')}
              value={measuringPoint}
              onChangeText={setMeasuringPoint}
            />
            <Field
              label={t('mobile.records.form.installDateLabel')}
              value={installationDate}
              onChangeText={setInstallationDate}
              placeholder="YYYY-MM-DD"
            />
            <LocationFields
              latitude={latitude}
              longitude={longitude}
              onLatitude={setLatitude}
              onLongitude={setLongitude}
              loading={isFetchingLocation}
              onLoading={setIsFetchingLocation}
            />
            <PhotoCapture
              isOnline={isOnline}
              serialNumber={serialNumber}
              year={year}
              uploadedPaths={photoPaths}
              localUris={localPhotoUris}
              onUploaded={setPhotoPaths}
              onLocal={setLocalPhotoUris}
              loading={isUploadingPhoto}
              onLoading={setIsUploadingPhoto}
            />
            <Text style={[type.sectionLabel, styles.sectionTitle]}>
              {t('mobile.records.form.finalSection')}
            </Text>
            <Field
              label={t('mobile.records.form.noteLabel')}
              value={notes}
              onChangeText={setNotes}
              multiline
            />
            {newValidation.length ? (
              <Panel tone="warning" style={styles.validation}>
                <Text style={type.caption}>{newValidation.join(', ')}</Text>
              </Panel>
            ) : null}
            <ActionButton
              testID="replacement-submit-btn"
              title={t('mobile.records.form.createReplacementButton')}
              icon="checkmark"
              size="lg"
              loading={createMutation.isPending}
              disabled={newValidation.length > 0}
              onPress={() => createMutation.mutate()}
            />
            <ActionButton
              title={t('mobile.common.cancel')}
              variant="ghost"
              onPress={() => router.back()}
              style={styles.secondary}
            />
          </>
        )}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

function parseOptionalFloat(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
}

const createStyles = (palette: ThemePalette) => ({
  root: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  draftBanner: { marginBottom: spacing.lg },
  draftDesc: { marginTop: spacing.xs },
  draftActions: {
    flexDirection: 'row' as const,
    justifyContent: 'flex-end' as const,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  sectionTitle: { marginTop: spacing.xl, marginBottom: spacing.md },
  switchPanel: { marginBottom: spacing.lg },
  switchRow: {
    minHeight: 48,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  switchBody: { flex: 1 },
  switchHint: { marginTop: spacing.xs },
  validation: { marginBottom: spacing.lg },
  secondary: { marginTop: spacing.sm },
  back: { alignSelf: 'flex-start' as const },
});
