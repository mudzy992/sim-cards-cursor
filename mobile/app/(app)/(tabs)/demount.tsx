/** Redizajnirani produkcijski ekran demontaze. */
import axios from 'axios';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  demountTasksApi,
  type DemountCompletionResolution,
  type DemountTaskItem,
  type DemountTaskStatus,
  type MeterDemountCategory,
  type RemovedSimDisposition,
} from '@/api/demount-tasks.api';
import { simCardsApi } from '@/api/sim-cards.api';
import { useAuthStore } from '@/store/auth.store';
import { listOutbox } from '@/offline/outbox';
import { palette, spacing, type } from '@/theme/tokens';
import { ScreenTitleBar } from '@/components/ui/ScreenTitleBar';
import { Panel } from '@/components/ui/Panel';
import { ActionButton } from '@/components/ui/ActionButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { Field } from '@/components/ui/Field';
import { WorkflowSteps } from '@/components/ui/WorkflowSteps';
import { ChoiceRow } from '@/components/ui/ChoiceRow';
import { ListRow } from '@/components/ui/ListRow';
import { TaskCard } from '@/features/tasks/TaskCard';
import { TaskFilterBar, taskMatchesFilter, type TaskFilter } from '@/features/tasks/TaskFilterBar';
import { WorkflowModal } from '@/features/tasks/WorkflowModal';

const resolutionLabels: Record<DemountCompletionResolution, string> = {
  FULL_DEMOUNT: 'Potpuna demontaža brojila i SIM-a',
  REPLACE_SIM: 'Demontaža SIM-a i zamjena novom',
  REMOVE_SIM_ONLY: 'Demontaža SIM-a bez zamjene',
};
const resolutionDescriptions: Record<DemountCompletionResolution, string> = {
  FULL_DEMOUNT: 'Brojilo se skida sa lokacije i ostaje bez aktivne SIM kartice.',
  REPLACE_SIM: 'Stara SIM se uklanja, a nova kartica se odmah ugrađuje.',
  REMOVE_SIM_ONLY: 'Brojilo ostaje na lokaciji bez SIM kartice.',
};
const removedSimLabels: Record<RemovedSimDisposition, string> = {
  MARK_DEFECTIVE: 'Označi uklonjenu SIM kao neispravnu',
  RETURN_TO_STOCK: 'Vrati uklonjenu SIM u zalihe',
};
const meterCategoryLabels: Record<MeterDemountCategory, string> = {
  METER_FAULTY: 'Brojilo neispravno',
  TEMPORARY_REMOVAL: 'Privremena demontaža SIM-a',
  MAINTENANCE: 'Servis ili održavanje',
  OTHER: 'Ostalo',
};

type DemountWizard = {
  task: DemountTaskItem;
  step: 1 | 2;
  isLocked: boolean;
  resolution?: DemountCompletionResolution;
  reason: string;
  removedSimDisposition?: RemovedSimDisposition;
  meterDemountCategory?: MeterDemountCategory;
  newSimCardId?: string;
  newSimIccid?: string;
  newSimIpAddress?: string;
};

export default function DemountScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const search = useLocalSearchParams<{ pickedIccid?: string | string[]; wizardTaskId?: string | string[] }>();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<DemountTaskItem[]>([]);
  const [filter, setFilter] = useState<TaskFilter>('ACTIVE');
  const [pendingTaskIds, setPendingTaskIds] = useState<Set<string>>(new Set());
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [wizard, setWizard] = useState<DemountWizard | null>(null);
  const [wizardSubmitting, setWizardSubmitting] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true); else setIsLoading(true);
    setError(null);
    try {
      const data = await demountTasksApi.getMy();
      setItems(data);
      if (user) {
        const outbox = await listOutbox(user);
        setPendingTaskIds(new Set(outbox.map((item) => item.meta?.taskId).filter(Boolean) as string[]));
      } else setPendingTaskIds(new Set());
    } catch (err) {
      setError(axios.isAxiosError(err) && !err.response
        ? 'Backend nije dostupan. Prikaz lokalnih zadataka nije uspio.'
        : 'Nije moguće učitati zadatke demontaže.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { void load(false); }, [load]));

  useEffect(() => {
    const rawIccid = typeof search.pickedIccid === 'string' ? search.pickedIccid : search.pickedIccid?.[0];
    const rawTaskId = typeof search.wizardTaskId === 'string' ? search.wizardTaskId : search.wizardTaskId?.[0];
    if (!rawIccid?.trim() || !rawTaskId) return;
    let cancelled = false;
    void (async () => {
      try {
        const card = await simCardsApi.scanByIccidWithOffline(rawIccid.trim());
        if (cancelled) return;
        setWizard((current) => current?.task.id === rawTaskId ? {
          ...current,
          newSimCardId: card.id,
          newSimIccid: card.iccid,
          newSimIpAddress: card.ipAddress,
        } : current);
      } catch {
        if (!cancelled) Alert.alert('Skeniranje nije uspjelo', 'Skenirana SIM nije pronađena ili nije dostupna.');
      } finally {
        if (!cancelled) router.replace('/(app)/(tabs)/demount' as const);
      }
    })();
    return () => { cancelled = true; };
  }, [search.pickedIccid, search.wizardTaskId, router]);

  const filteredItems = useMemo(() => items.filter((item) => taskMatchesFilter(item.status, filter)), [items, filter]);

  const changeStatus = async (task: DemountTaskItem, status: DemountTaskStatus) => {
    setUpdatingId(task.id);
    try {
      await demountTasksApi.updateStatus(task.id, status);
      await load(true);
    } catch (err) {
      const message = axios.isAxiosError(err) && typeof err.response?.data?.message === 'string'
        ? err.response.data.message : 'Ažuriranje statusa nije uspjelo.';
      Alert.alert('Greška', message);
    } finally { setUpdatingId(null); }
  };

  const openWizard = (task: DemountTaskItem) => {
    const isLocked = Boolean(task.requestedResolution);
    setWizard({
      task,
      step: isLocked ? 2 : 1,
      isLocked,
      resolution: task.requestedResolution ?? undefined,
      reason: task.requestedReason ?? '',
      removedSimDisposition: task.requestedRemovedSimDisposition ?? undefined,
      meterDemountCategory: task.requestedMeterDemountCategory ?? undefined,
    });
  };

  const updateWizard = (patch: Partial<DemountWizard>) => setWizard((current) => current ? { ...current, ...patch } : current);
  const scanNewSim = () => {
    if (!wizard) return;
    router.push({ pathname: '/(app)/(tabs)/scan', params: { afterScan: 'demount', demountTaskId: wizard.task.id } });
  };

  const submitWizard = async () => {
    if (!wizard?.resolution) { Alert.alert('Nedostaje izbor', 'Odaberite način završetka demontaže.'); return; }
    if (!wizard.removedSimDisposition) { Alert.alert('Nedostaje izbor', 'Odaberite ishod uklonjene SIM kartice.'); return; }
    const needsCategory = wizard.resolution === 'FULL_DEMOUNT' || wizard.resolution === 'REMOVE_SIM_ONLY';
    if (needsCategory && !wizard.meterDemountCategory) { Alert.alert('Nedostaje kategorija', 'Odaberite kategoriju demontaže.'); return; }
    if (wizard.resolution === 'REPLACE_SIM' && !wizard.newSimCardId) { Alert.alert('Nedostaje nova SIM', 'Skenirajte karticu koja zamjenjuje staru.'); return; }
    const reason = wizard.reason.trim();
    if (!reason) { Alert.alert('Nedostaje obrazloženje', 'Unesite razlog demontaže ili zamjene.'); return; }

    setWizardSubmitting(true);
    try {
      await demountTasksApi.complete(wizard.task.id, {
        resolution: wizard.resolution,
        reason,
        removedSimDisposition: wizard.removedSimDisposition,
        ...(wizard.meterDemountCategory ? { meterDemountCategory: wizard.meterDemountCategory } : {}),
        ...(wizard.resolution === 'REPLACE_SIM' && wizard.newSimCardId ? { newSimCardId: wizard.newSimCardId } : {}),
      });
      setWizard(null);
      await load(true);
    } catch (err) {
      const message = axios.isAxiosError(err) && typeof err.response?.data?.message === 'string'
        ? err.response.data.message : 'Završetak zadatka nije uspio.';
      Alert.alert('Greška', message);
    } finally { setWizardSubmitting(false); }
  };

  const activeCount = items.filter((item) => item.status === 'PENDING' || item.status === 'IN_PROGRESS').length;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenTitleBar title="Demontaža" subtitle={`${activeCount} aktivnih zadataka`}
        actionIcon="refresh" actionLabel="Osvježi" onAction={() => void load(true)} />
      <TaskFilterBar value={filter} onChange={setFilter} counts={{ active: activeCount }} />
      {isLoading ? <View style={styles.loading}><SkeletonRows count={5} /></View> : error ? (
        <View style={styles.stateWrap}><Panel tone="danger">
          <Text style={styles.errorTitle}>Zadaci nisu dostupni</Text><Text style={styles.errorText}>{error}</Text>
          <ActionButton title="Pokušaj ponovo" icon="refresh" onPress={() => void load(true)} />
        </Panel></View>
      ) : (
        <FlatList data={filteredItems} keyExtractor={(item) => item.id} contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void load(true)} colors={[palette.brand]} />}
          ListEmptyComponent={<EmptyState icon="checkmark-done-circle-outline"
            title={filter === 'ACTIVE' ? 'Sve je riješeno' : 'Nema zadataka u ovom prikazu'}
            description={filter === 'ACTIVE' ? 'Trenutno nemate aktivnih zadataka demontaže.' : 'Promijenite filter ili osvježite listu.'} />}
          renderItem={({ item }) => <TaskCard
            title={item.meter?.serialNumber ?? item.meterId} status={item.status} createdAt={item.createdAt}
            createdBy={item.createdBy ? `${item.createdBy.firstName} ${item.createdBy.lastName}` : null}
            pendingOffline={pendingTaskIds.has(item.id)} note={item.notes}
            metadata={[
              ...(item.meter?.simCard ? [{ label: 'SIM / IP', value: `${item.meter.simCard.iccid} · ${item.meter.simCard.ipAddress}` }] : []),
              ...(item.meter?.meterTypeDefinition?.name ? [{ label: 'Tip brojila', value: item.meter.meterTypeDefinition.name }] : []),
              ...(item.completionResolution && item.status === 'COMPLETED' ? [{ label: 'Način', value: resolutionLabels[item.completionResolution] }] : []),
            ]}
            updating={updatingId === item.id}
            primaryLabel={item.status === 'PENDING' ? 'Započni' : item.status === 'IN_PROGRESS' ? 'Završi demontažu' : undefined}
            onPrimary={item.status === 'PENDING' ? () => void changeStatus(item, 'IN_PROGRESS') : item.status === 'IN_PROGRESS' ? () => openWizard(item) : undefined}
            secondaryLabel={item.status === 'IN_PROGRESS' ? 'Vrati inicijatoru' : undefined}
            onSecondary={item.status === 'IN_PROGRESS' ? () => void changeStatus(item, 'PENDING') : undefined} />}
        />
      )}

      <WorkflowModal visible={Boolean(wizard)} title="Završetak demontaže"
        subtitle={wizard ? `Brojilo ${wizard.task.meter?.serialNumber ?? wizard.task.meterId}` : undefined}
        onClose={() => setWizard(null)}
        footer={wizard?.step === 2 ? <ActionButton title="Potvrdi završetak" icon="checkmark"
          onPress={() => void submitWizard()} loading={wizardSubmitting} size="lg" /> : undefined}>
        {wizard ? <>
          <WorkflowSteps header="DEMONTAŽA · VOĐENI POSTUPAK" steps={[
            { key: 'task', label: 'Zadatak preuzet', state: 'done', detail: wizard.task.meter?.serialNumber ?? wizard.task.meterId },
            { key: 'resolution', label: 'Način završetka', state: wizard.resolution ? 'done' : 'current', detail: wizard.resolution ? resolutionLabels[wizard.resolution] : undefined },
            { key: 'details', label: 'Ishod i obrazloženje', state: wizard.step === 2 ? 'current' : 'pending' },
            { key: 'confirm', label: 'Potvrda', state: 'pending' },
          ]} />

          {wizard.step === 1 ? <>
            <Text style={[type.sectionLabel, styles.sectionTitle]}>Odaberite način završetka</Text>
            {(Object.keys(resolutionLabels) as DemountCompletionResolution[]).map((key) =>
              <ChoiceRow key={key} label={resolutionLabels[key]} description={resolutionDescriptions[key]}
                selected={wizard.resolution === key} onPress={() => updateWizard({ resolution: key, step: 2 })} />)}
          </> : <>
            {!wizard.isLocked ? <ActionButton title="Promijeni način završetka" variant="ghost" icon="arrow-back"
              onPress={() => updateWizard({ step: 1 })} style={styles.backAction} /> : null}
            <Text style={[type.sectionLabel, styles.sectionTitle]}>Način završetka</Text>
            <Panel tone="info"><Text style={type.bodyStrong}>{wizard.resolution ? resolutionLabels[wizard.resolution] : '—'}</Text>
              {wizard.isLocked ? <Text style={[type.caption, styles.lockedText]}>Definisao inicijator zadatka</Text> : null}</Panel>

            <Text style={[type.sectionLabel, styles.sectionTitle]}>Ishod uklonjene SIM</Text>
            {wizard.isLocked ? <Panel><Text style={type.bodyStrong}>{wizard.removedSimDisposition ? removedSimLabels[wizard.removedSimDisposition] : '—'}</Text></Panel>
              : (Object.keys(removedSimLabels) as RemovedSimDisposition[]).map((key) =>
                <ChoiceRow key={key} label={removedSimLabels[key]} selected={wizard.removedSimDisposition === key}
                  onPress={() => updateWizard({ removedSimDisposition: key })} />)}

            {wizard.resolution === 'FULL_DEMOUNT' || wizard.resolution === 'REMOVE_SIM_ONLY' ? <>
              <Text style={[type.sectionLabel, styles.sectionTitle]}>Kategorija demontaže</Text>
              {wizard.isLocked ? <Panel><Text style={type.bodyStrong}>{wizard.meterDemountCategory ? meterCategoryLabels[wizard.meterDemountCategory] : '—'}</Text></Panel>
                : (Object.keys(meterCategoryLabels) as MeterDemountCategory[]).map((key) =>
                  <ChoiceRow key={key} label={meterCategoryLabels[key]} selected={wizard.meterDemountCategory === key}
                    onPress={() => updateWizard({ meterDemountCategory: key })} />)}
            </> : null}

            {wizard.resolution === 'REPLACE_SIM' ? <>
              <Text style={[type.sectionLabel, styles.sectionTitle]}>Nova SIM kartica</Text>
              <Panel tone={wizard.newSimCardId ? 'success' : 'info'}>
                {wizard.newSimIccid ? <><Text style={type.dataLarge}>{wizard.newSimIccid}</Text>
                  <Text style={[type.dataSmall, styles.ipText]}>IP {wizard.newSimIpAddress?.trim() || '—'}</Text></>
                  : <Text style={type.body}>Skenirajte karticu koja će zamijeniti staru.</Text>}
                <ActionButton title={wizard.newSimCardId ? 'Promijeni novu SIM' : 'Skeniraj novu SIM'} icon="barcode-outline"
                  onPress={scanNewSim} variant={wizard.newSimCardId ? 'secondary' : 'primary'} style={styles.panelAction} />
              </Panel>
            </> : null}

            <Text style={[type.sectionLabel, styles.sectionTitle]}>Obrazloženje</Text>
            <Field label="Razlog demontaže ili zamjene" required value={wizard.reason}
              onChangeText={(value) => updateWizard({ reason: value })}
              placeholder="Opišite razlog i izvedenu radnju" multiline />

            <Text style={[type.sectionLabel, styles.sectionTitle]}>Trenutno brojilo</Text>
            <Panel padding="none"><View style={styles.panelInner}>
              <ListRow title="Serijski broj" value={wizard.task.meter?.serialNumber ?? wizard.task.meterId} valueMono />
              {wizard.task.meter?.simCard ? <ListRow title="Ugrađena SIM" value={wizard.task.meter.simCard.iccid} valueMono divider /> : null}
            </View></Panel>
          </>}
        </> : null}
      </WorkflowModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.background },
  loading: { padding: spacing.xl },
  stateWrap: { padding: spacing.xl },
  errorTitle: { ...type.bodyStrong, color: palette.danger, marginBottom: spacing.xs },
  errorText: { ...type.caption, marginBottom: spacing.lg },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, flexGrow: 1 },
  sectionTitle: { marginTop: spacing.xl, marginBottom: spacing.md },
  backAction: { alignSelf: 'flex-start', marginTop: spacing.sm },
  lockedText: { marginTop: spacing.xs },
  ipText: { marginTop: spacing.xs },
  panelAction: { marginTop: spacing.lg },
  panelInner: { paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
});