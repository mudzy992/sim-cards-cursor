/** Redizajnirani produkcijski ekran ugradnje sa GPS sortiranjem i navigacijom. */
import axios from 'axios';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  installTasksApi,
  type InstallTaskItem,
  type InstallTaskStatus,
} from '@/api/install-tasks.api';
import { simCardsApi } from '@/api/sim-cards.api';
import {
  meterTypeDefinitionsApi,
  type MeterTypeFieldItem,
} from '@/api/meter-type-definitions.api';
import { useAuthStore } from '@/store/auth.store';
import { listOutbox } from '@/offline/outbox';
import {
  spacing,
  useTheme,
  useThemedStyles,
  type ThemePalette,
  type ThemeTypography,
} from '@/theme/tokens';
import { ScreenTitleBar } from '@/components/ui/ScreenTitleBar';
import { Panel } from '@/components/ui/Panel';
import { ActionButton } from '@/components/ui/ActionButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { Field } from '@/components/ui/Field';
import { WorkflowSteps } from '@/components/ui/WorkflowSteps';
import { ListRow } from '@/components/ui/ListRow';
import {
  SegmentedFilter,
  type SegmentOption,
} from '@/components/ui/SegmentedFilter';
import { TaskCard } from '@/features/tasks/TaskCard';
import {
  TaskFilterBar,
  taskMatchesFilter,
  type TaskFilter,
} from '@/features/tasks/TaskFilterBar';
import { WorkflowModal } from '@/features/tasks/WorkflowModal';
import {
  DynamicMeterFields,
  validateRequiredDynamicFields,
} from '@/features/tasks/DynamicMeterFields';
import {
  calculateDistanceMeters,
  extractCoordinates,
  openInExternalMaps,
  type GeoPoint,
} from '@/utils/geo';
import { hapticSuccess } from '@/utils/haptics';

type SortMode = 'RECENT' | 'NEAREST';

const sortOptions: Array<SegmentOption<SortMode>> = [
  { key: 'RECENT', label: 'Najnovije' },
  { key: 'NEAREST', label: 'Najbliže' },
];

type InstallWizard = {
  task: InstallTaskItem;
  recordNotes: string;
  pickedSimCardId?: string;
  pickedSimIccid?: string;
  pickedSimIpAddress?: string;
  calibrationYear: string;
  installationAddress: string;
  installationDate: string;
  city: string;
  municipality: string;
  measuringPoint: string;
  latitude: string;
  longitude: string;
  dynamicFieldValues: Record<string, unknown>;
};

export default function InstallScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { palette, type } = useTheme();
  const styles = useThemedStyles(createStyles);
  const search = useLocalSearchParams<{
    pickedIccid?: string | string[];
    wizardTaskId?: string | string[];
  }>();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<InstallTaskItem[]>([]);
  const [filter, setFilter] = useState<TaskFilter>('ACTIVE');
  const [sortMode, setSortMode] = useState<SortMode>('RECENT');
  const [userPoint, setUserPoint] = useState<GeoPoint | null>(null);
  const [pendingTaskIds, setPendingTaskIds] = useState<Set<string>>(new Set());
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [wizardFields, setWizardFields] = useState<MeterTypeFieldItem[]>([]);
  const [wizard, setWizard] = useState<InstallWizard | null>(null);
  const [wizardSubmitting, setWizardSubmitting] = useState(false);

  const refreshLocation = useCallback(async () => {
    try {
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setUserPoint({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
    } catch {
      // Lokacija je opcionalna
    }
  }, []);

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setIsRefreshing(true);
      else setIsLoading(true);
      setError(null);
      try {
        const data = await installTasksApi.getMy();
        setItems(data);
        if (user) {
          const outbox = await listOutbox(user);
          setPendingTaskIds(
            new Set(
              outbox.map((item) => item.meta?.taskId).filter(Boolean) as string[],
            ),
          );
        } else {
          setPendingTaskIds(new Set());
        }
      } catch (err) {
        setError(
          axios.isAxiosError(err) && !err.response
            ? 'Backend nije dostupan. Prikaz lokalnih zadataka nije uspio.'
            : 'Nije moguće učitati zadatke ugradnje.',
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [user],
  );

  useFocusEffect(
    useCallback(() => {
      void load(false);
      void refreshLocation();
    }, [load, refreshLocation]),
  );

  useEffect(() => {
    const rawIccid =
      typeof search.pickedIccid === 'string'
        ? search.pickedIccid
        : search.pickedIccid?.[0];
    const rawTaskId =
      typeof search.wizardTaskId === 'string'
        ? search.wizardTaskId
        : search.wizardTaskId?.[0];
    if (!rawIccid?.trim() || !rawTaskId) return;
    let cancelled = false;
    void (async () => {
      try {
        const card = await simCardsApi.scanByIccidWithOffline(rawIccid.trim());
        const claimed = await simCardsApi.claimById(card.id);
        if (cancelled) return;
        setWizard((current) =>
          current?.task.id === rawTaskId
            ? {
                ...current,
                pickedSimCardId: claimed.id,
                pickedSimIccid: claimed.iccid,
                pickedSimIpAddress: claimed.ipAddress,
              }
            : current,
        );
      } catch {
        if (!cancelled) {
          Alert.alert(
            'Skeniranje nije uspjelo',
            'SIM nije pronađena, nije dostupna za zaduživanje ili zaduživanje nije uspjelo.',
          );
        }
      } finally {
        if (!cancelled) router.replace('/(app)/(tabs)/install' as const);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [search.pickedIccid, search.wizardTaskId, router]);

  useEffect(() => {
    const typeId = wizard?.task.meter?.meterTypeDefinitionId;
    if (!typeId) {
      setWizardFields([]);
      return;
    }
    let cancelled = false;
    void meterTypeDefinitionsApi
      .listFields(typeId)
      .then((fields) => {
        if (!cancelled) setWizardFields(fields);
      })
      .catch(() => {
        if (!cancelled) setWizardFields([]);
      });
    return () => {
      cancelled = true;
    };
  }, [wizard?.task.meter?.meterTypeDefinitionId]);

  const enrichedItems = useMemo(() => {
    const matching = items
      .filter((item) => taskMatchesFilter(item.status, filter))
      .map((item) => {
        const coords = extractCoordinates(item.meter);
        const distanceMeters =
          userPoint && coords
            ? calculateDistanceMeters(userPoint, coords)
            : null;
        return { item, coords, distanceMeters };
      });
    if (sortMode === 'NEAREST') {
      return [...matching].sort((a, b) => {
        if (a.distanceMeters == null && b.distanceMeters == null) return 0;
        if (a.distanceMeters == null) return 1;
        if (b.distanceMeters == null) return -1;
        return a.distanceMeters - b.distanceMeters;
      });
    }
    return matching;
  }, [items, filter, sortMode, userPoint]);

  const activeCount = useMemo(
    () =>
      items.filter(
        (item) => item.status === 'PENDING' || item.status === 'IN_PROGRESS',
      ).length,
    [items],
  );

  const changeStatus = async (
    task: InstallTaskItem,
    status: InstallTaskStatus,
  ) => {
    setUpdatingId(task.id);
    try {
      await installTasksApi.updateStatus(task.id, status);
      hapticSuccess();
      await load(true);
    } catch (err) {
      const message =
        axios.isAxiosError(err) && typeof err.response?.data?.message === 'string'
          ? err.response.data.message
          : 'Ažuriranje statusa nije uspjelo.';
      Alert.alert('Greška', message);
    } finally {
      setUpdatingId(null);
    }
  };

  const openWizard = (task: InstallTaskItem) => {
    const meter = task.meter;
    const today = new Date().toISOString().slice(0, 10);
    setWizardFields([]);
    setWizard({
      task,
      recordNotes: '',
      calibrationYear:
        meter?.calibrationYear != null ? String(meter.calibrationYear) : '',
      installationAddress: meter?.installationAddress ?? '',
      installationDate: meter?.installationDate
        ? String(meter.installationDate).slice(0, 10)
        : today,
      city: meter?.city ?? '',
      municipality: meter?.municipality ?? '',
      measuringPoint: meter?.measuringPoint ?? '',
      latitude: meter?.latitude != null ? String(meter.latitude) : '',
      longitude: meter?.longitude != null ? String(meter.longitude) : '',
      dynamicFieldValues:
        meter?.dynamicFieldValues &&
        typeof meter.dynamicFieldValues === 'object'
          ? (meter.dynamicFieldValues as Record<string, unknown>)
          : {},
    });
  };

  const updateWizard = (patch: Partial<InstallWizard>) =>
    setWizard((current) => (current ? { ...current, ...patch } : current));
  const scanSim = () => {
    if (!wizard) return;
    router.push({
      pathname: '/(app)/(tabs)/scan',
      params: { afterScan: 'install', installTaskId: wizard.task.id },
    });
  };

  const submitWizard = async () => {
    if (!wizard?.pickedSimCardId) {
      Alert.alert('SIM kartica', 'Skenirajte SIM karticu koju ugrađujete.');
      return;
    }
    const missing = validateRequiredDynamicFields(
      wizardFields,
      wizard.dynamicFieldValues,
    );
    if (missing.length) {
      Alert.alert('Nedostaju podaci', `Obavezna polja: ${missing.join(', ')}`);
      return;
    }
    const calibrationYear = parseOptionalInteger(wizard.calibrationYear);
    const latitude = parseOptionalFloat(wizard.latitude);
    const longitude = parseOptionalFloat(wizard.longitude);
    if (wizard.calibrationYear.trim() && calibrationYear === undefined) {
      Alert.alert(
        'Neispravan unos',
        'Godina baždarenja mora biti cijeli broj.',
      );
      return;
    }
    setWizardSubmitting(true);
    try {
      const freshLocation = wizard.task.meter?.isDemountedFromLocation === true;
      await installTasksApi.complete(wizard.task.id, {
        simCardId: wizard.pickedSimCardId,
        recordNotes: wizard.recordNotes.trim() || undefined,
        ...(calibrationYear !== undefined ? { calibrationYear } : {}),
        ...(freshLocation
          ? {
              installationAddress:
                wizard.installationAddress.trim() || undefined,
              installationDate: wizard.installationDate.trim() || undefined,
              city: wizard.city.trim() || undefined,
              municipality: wizard.municipality.trim() || undefined,
              measuringPoint: wizard.measuringPoint.trim() || undefined,
              ...(latitude !== undefined ? { latitude } : {}),
              ...(longitude !== undefined ? { longitude } : {}),
            }
          : {}),
        ...(Object.keys(wizard.dynamicFieldValues).length
          ? { dynamicFieldValues: wizard.dynamicFieldValues }
          : {}),
      });
      hapticSuccess();
      setWizard(null);
      await load(true);
    } catch (err) {
      const message =
        axios.isAxiosError(err) && typeof err.response?.data?.message === 'string'
          ? err.response.data.message
          : 'Završetak zadatka nije uspio.';
      Alert.alert('Greška', message);
    } finally {
      setWizardSubmitting(false);
    }
  };

  const handleSortChange = (mode: SortMode) => {
    setSortMode(mode);
    if (mode === 'NEAREST' && !userPoint) {
      void (async () => {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status === 'granted') {
          await refreshLocation();
        }
      })();
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenTitleBar
        title="Ugradnja"
        subtitle={`${activeCount} aktivnih zadataka`}
        actionIcon="refresh"
        actionLabel="Osvježi"
        onAction={() => {
          void load(true);
          void refreshLocation();
        }}
      />
      <TaskFilterBar
        value={filter}
        onChange={setFilter}
        counts={{ active: activeCount }}
      />
      <SegmentedFilter
        options={sortOptions}
        value={sortMode}
        onChange={handleSortChange}
        style={styles.sortFilter}
      />
      {isLoading ? (
        <View style={styles.loading}>
          <SkeletonRows count={5} />
        </View>
      ) : error ? (
        <View style={styles.stateWrap}>
          <Panel tone="danger">
            <Text style={styles.errorTitle}>Zadaci nisu dostupni</Text>
            <Text style={styles.errorText}>{error}</Text>
            <ActionButton
              title="Pokušaj ponovo"
              icon="refresh"
              onPress={() => void load(true)}
            />
          </Panel>
        </View>
      ) : (
        <FlatList
          data={enrichedItems}
          keyExtractor={({ item }) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                void load(true);
                void refreshLocation();
              }}
              colors={[palette.brandText]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="checkmark-done-circle-outline"
              title={
                filter === 'ACTIVE'
                  ? 'Sve je riješeno'
                  : 'Nema zadataka u ovom prikazu'
              }
              description={
                filter === 'ACTIVE'
                  ? 'Trenutno nemate aktivnih zadataka ugradnje.'
                  : 'Promijenite filter ili osvježite listu.'
              }
            />
          }
          renderItem={({ item: { item, coords, distanceMeters } }) => (
            <TaskCard
              title={item.meter?.serialNumber ?? item.meterId}
              status={item.status}
              createdAt={item.createdAt}
              createdBy={
                item.createdBy
                  ? `${item.createdBy.firstName} ${item.createdBy.lastName}`
                  : null
              }
              pendingOffline={pendingTaskIds.has(item.id)}
              note={item.notes}
              distanceMeters={distanceMeters}
              onNavigate={
                coords
                  ? () =>
                      void openInExternalMaps(
                        coords,
                        item.meter?.installationAddress ??
                          item.meter?.serialNumber,
                      )
                  : undefined
              }
              metadata={[
                ...(item.meter?.meterTypeDefinition?.name
                  ? [
                      {
                        label: 'Tip brojila',
                        value: item.meter.meterTypeDefinition.name,
                      },
                    ]
                  : []),
                ...(item.meter?.installationAddress
                  ? [
                      {
                        label: 'Adresa',
                        value: item.meter.installationAddress,
                      },
                    ]
                  : []),
                ...(item.installationRecord?.recordNumber &&
                item.status === 'COMPLETED'
                  ? [
                      {
                        label: 'Zapisnik',
                        value: item.installationRecord.recordNumber,
                      },
                    ]
                  : []),
              ]}
              updating={updatingId === item.id}
              primaryLabel={
                item.status === 'PENDING'
                  ? 'Započni'
                  : item.status === 'IN_PROGRESS'
                    ? 'Završi ugradnju'
                    : undefined
              }
              onPrimary={
                item.status === 'PENDING'
                  ? () => void changeStatus(item, 'IN_PROGRESS')
                  : item.status === 'IN_PROGRESS'
                    ? () => openWizard(item)
                    : undefined
              }
              secondaryLabel={
                item.status === 'IN_PROGRESS' ? 'Vrati na čekanje' : undefined
              }
              onSecondary={
                item.status === 'IN_PROGRESS'
                  ? () => void changeStatus(item, 'PENDING')
                  : undefined
              }
            />
          )}
        />
      )}

      <WorkflowModal
        visible={Boolean(wizard)}
        title="Završetak ugradnje"
        subtitle={
          wizard
            ? `Brojilo ${wizard.task.meter?.serialNumber ?? wizard.task.meterId}`
            : undefined
        }
        onClose={() => setWizard(null)}
        footer={
          <ActionButton
            title="Potvrdi ugradnju"
            icon="checkmark"
            onPress={() => void submitWizard()}
            loading={wizardSubmitting}
            disabled={!wizard?.pickedSimCardId}
            size="lg"
          />
        }
      >
        {wizard ? (
          <>
            <WorkflowSteps
              header="UGRADNJA · VOĐENI POSTUPAK"
              steps={[
                {
                  key: 'task',
                  label: 'Zadatak preuzet',
                  state: 'done',
                  detail:
                    wizard.task.meter?.serialNumber ?? wizard.task.meterId,
                },
                {
                  key: 'sim',
                  label: 'SIM kartica',
                  state: wizard.pickedSimCardId ? 'done' : 'current',
                  detail: wizard.pickedSimIccid,
                },
                {
                  key: 'data',
                  label: 'Podaci ugradnje',
                  state: wizard.pickedSimCardId ? 'current' : 'pending',
                },
                { key: 'confirm', label: 'Potvrda', state: 'pending' },
              ]}
            />
            <Text style={[type.sectionLabel, styles.sectionTitle]}>Brojilo</Text>
            <Panel padding="none">
              <View style={styles.panelInner}>
                <ListRow
                  title="Serijski broj"
                  value={wizard.task.meter?.serialNumber ?? wizard.task.meterId}
                  valueMono
                />
                {wizard.task.meter?.meterTypeDefinition?.name ? (
                  <ListRow
                    title="Tip brojila"
                    value={wizard.task.meter.meterTypeDefinition.name}
                    divider
                  />
                ) : null}
              </View>
            </Panel>
            <Text style={[type.sectionLabel, styles.sectionTitle]}>
              SIM kartica
            </Text>
            <Panel tone={wizard.pickedSimCardId ? 'success' : 'info'}>
              {wizard.pickedSimIccid ? (
                <>
                  <Text style={type.dataLarge}>{wizard.pickedSimIccid}</Text>
                  <Text style={[type.dataSmall, styles.ipText]}>
                    IP {wizard.pickedSimIpAddress?.trim() || '—'}
                  </Text>
                </>
              ) : (
                <Text style={type.body}>
                  Skenirajte karticu koja će biti ugrađena u brojilo.
                </Text>
              )}
              <ActionButton
                title={wizard.pickedSimCardId ? 'Promijeni SIM' : 'Skeniraj SIM'}
                icon="barcode-outline"
                onPress={scanSim}
                variant={wizard.pickedSimCardId ? 'secondary' : 'primary'}
                style={styles.panelAction}
              />
            </Panel>
            <Text style={[type.sectionLabel, styles.sectionTitle]}>
              Podaci ugradnje
            </Text>
            <Field
              label="Godina baždarenja"
              value={wizard.calibrationYear}
              onChangeText={(value) =>
                updateWizard({ calibrationYear: value.replace(/\D/g, '') })
              }
              keyboardType="number-pad"
              placeholder="npr. 2026"
            />
            {wizard.task.meter?.isDemountedFromLocation ? (
              <>
                <Panel tone="warning" style={styles.notice}>
                  <Text style={type.bodyStrong}>
                    Brojilo je demontirano sa lokacije
                  </Text>
                  <Text style={[type.caption, styles.noticeText]}>
                    Unesite svježe podatke nove lokacije.
                  </Text>
                </Panel>
                <Field
                  label="Adresa"
                  value={wizard.installationAddress}
                  onChangeText={(value) =>
                    updateWizard({ installationAddress: value })
                  }
                  placeholder="Ulica i broj"
                />
                <Field
                  label="Grad"
                  value={wizard.city}
                  onChangeText={(value) => updateWizard({ city: value })}
                />
                <Field
                  label="Općina"
                  value={wizard.municipality}
                  onChangeText={(value) =>
                    updateWizard({ municipality: value })
                  }
                />
                <Field
                  label="Mjerno mjesto"
                  value={wizard.measuringPoint}
                  onChangeText={(value) =>
                    updateWizard({ measuringPoint: value })
                  }
                />
                <Field
                  label="Datum instalacije"
                  value={wizard.installationDate}
                  onChangeText={(value) =>
                    updateWizard({ installationDate: value })
                  }
                  placeholder="YYYY-MM-DD"
                />
                <Field
                  label="Širina"
                  value={wizard.latitude}
                  onChangeText={(value) => updateWizard({ latitude: value })}
                  keyboardType="decimal-pad"
                />
                <Field
                  label="Dužina"
                  value={wizard.longitude}
                  onChangeText={(value) => updateWizard({ longitude: value })}
                  keyboardType="decimal-pad"
                />
              </>
            ) : null}
            <DynamicMeterFields
              fields={wizardFields}
              values={wizard.dynamicFieldValues}
              onChange={(name, value) =>
                updateWizard({
                  dynamicFieldValues: {
                    ...wizard.dynamicFieldValues,
                    [name]: value,
                  },
                })
              }
            />
            <Field
              label="Napomena za zapisnik"
              value={wizard.recordNotes}
              onChangeText={(value) => updateWizard({ recordNotes: value })}
              placeholder="Opcionalno"
              multiline
            />
          </>
        ) : null}
      </WorkflowModal>
    </SafeAreaView>
  );
}

function parseOptionalInteger(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}
function parseOptionalFloat(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number.parseFloat(value.trim().replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
}

const createStyles = (palette: ThemePalette, type: ThemeTypography) => ({
  root: { flex: 1, backgroundColor: palette.background },
  sortFilter: { marginHorizontal: spacing.xl, marginBottom: spacing.md },
  loading: { padding: spacing.xl },
  stateWrap: { padding: spacing.xl },
  errorTitle: {
    ...type.bodyStrong,
    color: palette.danger,
    marginBottom: spacing.xs,
  },
  errorText: { ...type.caption, marginBottom: spacing.lg },
  list: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    flexGrow: 1,
  },
  sectionTitle: { marginTop: spacing.xl, marginBottom: spacing.md },
  panelInner: { paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
  ipText: { marginTop: spacing.xs },
  panelAction: { marginTop: spacing.lg },
  notice: { marginBottom: spacing.lg },
  noticeText: { marginTop: spacing.xs },
});
