/** Novi priključak — vođeni zapisnik ugradnje sa auto-save nacrtom i skeniranjem serijskog broja. */
import axios from 'axios';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { validateMeterSerialLength } from '@sim-tracker/shared';
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

export default function CreateRecordScreen() {
  const router = useRouter();
  const { type } = useTheme();
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const params = useLocalSearchParams<{
    simCardId?: string | string[];
    pickedSerial?: string | string[];
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
  const user = useAuthStore((state) => state.user);
  const { isOnline } = useConnectivity();
  const draftScope = `new:${simCardId}`;

  const [meterTypeId, setMeterTypeId] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [year, setYear] = useState('');
  const [calibrationYear, setCalibrationYear] = useState('');
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
  const [dynamicFieldValues, setDynamicFieldValues] = useState<
    Record<string, unknown>
  >({});
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
    setDynamicFieldValues({});
  }, [meterTypeId]);

  useEffect(() => {
    if (pickedSerial) {
      setSerialNumber(pickedSerial);
    }
  }, [pickedSerial]);

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
      dynamicFieldValues,
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
    dynamicFieldValues,
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
      setDynamicFieldValues(pendingDraft.dynamicFieldValues);
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
  const meterTypes = useMemo(
    () =>
      Array.isArray(meterTypesQuery.data) ? meterTypesQuery.data : [],
    [meterTypesQuery.data],
  );
  const selectedMeterType = useMemo(
    () => meterTypes.find((item) => item.id === meterTypeId),
    [meterTypes, meterTypeId],
  );
  const serialLengthCheck = useMemo(
    () =>
      validateMeterSerialLength(
        serialNumber,
        selectedMeterType?.serialNumberLength,
      ),
    [serialNumber, selectedMeterType?.serialNumberLength],
  );
  const serialLengthError =
    serialNumber.trim().length > 0 && !serialLengthCheck.valid
      ? t('mobile.records.form.serialLengthMismatchError', {
          expected: serialLengthCheck.expectedLength ?? 0,
        })
      : null;
  const serialLengthHelper = selectedMeterType?.serialNumberLength
    ? t('mobile.records.form.serialLengthHelper', {
        expected: selectedMeterType.serialNumberLength,
        actual: serialNumber.trim().length,
      })
    : null;
  const dynamicFields = useMemo(
    () => (Array.isArray(fieldsQuery.data) ? fieldsQuery.data : []),
    [fieldsQuery.data],
  );
  const typesError =
    meterTypesQuery.isError ||
    (meterTypesQuery.isFetched &&
      !meterTypesQuery.isLoading &&
      meterTypesQuery.data === undefined);

  const validation = useMemo(() => {
    const missing: string[] = [];
    if (!meterTypeId) missing.push(t('mobile.records.form.reqMeterType'));
    if (!serialNumber.trim()) {
      missing.push(t('mobile.records.form.reqSerial'));
    } else if (!serialLengthCheck.valid && serialLengthCheck.expectedLength) {
      missing.push(
        t('mobile.records.form.serialLengthMismatch', {
          expected: serialLengthCheck.expectedLength,
        }),
      );
    }
    if (!year.trim()) missing.push(t('mobile.records.form.reqYear'));
    if (!calibrationYear.trim())
      missing.push(t('mobile.records.form.reqCalibration'));
    missing.push(
      ...validateRequiredDynamicFields(dynamicFields, dynamicFieldValues),
    );
    return missing;
  }, [
    meterTypeId,
    serialNumber,
    serialLengthCheck,
    year,
    calibrationYear,
    dynamicFields,
    dynamicFieldValues,
    t,
  ]);

  const buildPayload = (): CreateInstallationRecordPayload & {
    localPhotoUris?: string[];
  } => {
    if (!user?.id || !simCardId) {
      throw new Error(t('mobile.records.form.missingUserOrSim'));
    }
    if (validation.length) {
      throw new Error(
        `${t('mobile.records.form.validationPrefix')} ${validation.join(', ')}`,
      );
    }
    const yearNumber = Number.parseInt(year, 10);
    const calibrationNumber = Number.parseInt(calibrationYear, 10);
    if (!Number.isFinite(yearNumber) || !Number.isFinite(calibrationNumber)) {
      throw new Error(t('mobile.records.form.yearsMustBeIntegers'));
    }
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
      dynamicFieldValues: Object.keys(dynamicFieldValues).length
        ? dynamicFieldValues
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
        t('mobile.records.form.createdSuccessNew'),
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
            t('mobile.records.form.savedOfflineNew'),
            [
              {
                text: t('mobile.common.ok'),
                onPress: () => router.replace('/(app)/(tabs)/records'),
              },
            ],
          );
          return;
        } catch {
          /* nastavi na standardnu poruku */
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
          title={t('mobile.records.form.newTitle')}
          onBack={() => router.back()}
        />
        <EmptyState
          icon="alert-circle-outline"
          title={t('mobile.records.form.missingSimTitle')}
          description={t('mobile.records.form.missingSimNewDesc')}
          actionLabel={t('mobile.common.back')}
          onAction={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenTitleBar
        title={t('mobile.records.form.newTitle')}
        subtitle={t('mobile.records.form.newSubtitle')}
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
          header={t('mobile.records.form.newHeader')}
          steps={[
            {
              key: 'sim',
              label: t('mobile.records.form.stepSim'),
              state: 'done',
              detail: simCardId,
            },
            {
              key: 'meter',
              label: t('mobile.records.form.stepMeter'),
              state: meterTypeId && serialNumber ? 'done' : 'current',
            },
            {
              key: 'location',
              label: t('mobile.records.form.stepLocation'),
              state: meterTypeId && serialNumber ? 'current' : 'pending',
            },
            {
              key: 'confirm',
              label: t('mobile.records.form.stepConfirm'),
              state: validation.length ? 'pending' : 'current',
            },
          ]}
        />

        <Text style={[type.sectionLabel, styles.sectionTitle]}>
          {t('mobile.records.form.meterSection')}
        </Text>
        <MeterTypePicker
          items={meterTypes}
          value={meterTypeId}
          onChange={setMeterTypeId}
          loading={meterTypesQuery.isLoading}
          error={typesError}
        />
        <Field
          testID="create-record-serial-input"
          label={t('mobile.records.form.serialNumberLabel')}
          required
          value={serialNumber}
          onChangeText={setSerialNumber}
          autoCapitalize="characters"
          error={serialLengthError}
          helper={serialLengthHelper}
          trailingAction={{
            icon: 'barcode-outline',
            accessibilityLabel: t('mobile.records.form.scanSerialAccessibility'),
            onPress: () =>
              router.push({
                pathname: '/(app)/(tabs)/scan',
                params: {
                  afterScan: 'meterSerial',
                  simCardId,
                  serialTarget: 'new',
                  returnTo: 'create-record',
                  ...(selectedMeterType?.serialNumberLength
                    ? {
                        expectedSerialLength: String(
                          selectedMeterType.serialNumberLength,
                        ),
                      }
                    : {}),
                },
              }),
          }}
        />
        <View style={styles.twoFields}>
          <Field
            testID="create-record-year-input"
            label={t('mobile.records.form.yearLabel')}
            required
            value={year}
            onChangeText={(v) => setYear(v.replace(/\D/g, ''))}
            keyboardType="number-pad"
            style={styles.flexField}
          />
          <Field
            testID="create-record-calibration-input"
            label={t('mobile.records.form.calibrationLabel')}
            required
            value={calibrationYear}
            onChangeText={(v) => setCalibrationYear(v.replace(/\D/g, ''))}
            keyboardType="number-pad"
            style={styles.flexField}
          />
        </View>
        {meterTypeId ? (
          <DynamicMeterFields
            fields={dynamicFields}
            values={dynamicFieldValues}
            loading={fieldsQuery.isLoading}
            error={fieldsQuery.isError}
            onChange={(name, value) =>
              setDynamicFieldValues((current) => ({
                ...current,
                [name]: value,
              }))
            }
          />
        ) : null}

        <Text style={[type.sectionLabel, styles.sectionTitle]}>
          {t('mobile.records.form.installLocationSection')}
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
          placeholder={t('mobile.common.optional')}
          multiline
        />
        {validation.length ? (
          <Panel tone="warning" style={styles.validation}>
            <Text style={type.bodyStrong}>
              {t('mobile.records.form.validationPrefix')}
            </Text>
            <Text style={[type.caption, styles.validationText]}>
              {validation.join(', ')}
            </Text>
          </Panel>
        ) : null}
        <ActionButton
          testID="create-record-submit-btn"
          title={t('mobile.records.form.createNewButton')}
          icon="checkmark"
          size="lg"
          loading={createMutation.isPending}
          disabled={validation.length > 0}
          onPress={() => createMutation.mutate()}
        />
        <ActionButton
          title={t('mobile.common.cancel')}
          variant="ghost"
          onPress={() => router.back()}
          style={styles.cancel}
        />
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
  twoFields: { flexDirection: 'row' as const, gap: spacing.md },
  flexField: { flex: 1 },
  validation: { marginBottom: spacing.lg },
  validationText: { marginTop: spacing.xs },
  cancel: { marginTop: spacing.sm },
});
