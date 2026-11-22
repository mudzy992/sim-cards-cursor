/** Redizajnirani produkcijski ekran demontaze sa temom i haptikom. */
import axios from 'axios';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, RefreshControl, Text, View } from 'react-native';
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
import { useTranslation } from '@/i18n/i18n.store';
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
import { ChoiceRow } from '@/components/ui/ChoiceRow';
import { ListRow } from '@/components/ui/ListRow';
import { TaskCard } from '@/features/tasks/TaskCard';
import {
  TaskFilterBar,
  taskMatchesFilter,
  type TaskFilter,
} from '@/features/tasks/TaskFilterBar';
import { WorkflowModal } from '@/features/tasks/WorkflowModal';
import { hapticSuccess } from '@/utils/haptics';

const resolutionLabelKeys: Record<DemountCompletionResolution, string> = {
  FULL_DEMOUNT: 'mobile.tasks.demount.resFull',
  REPLACE_SIM: 'mobile.tasks.demount.resReplace',
  REMOVE_SIM_ONLY: 'mobile.tasks.demount.resRemoveOnly',
};
const resolutionDescKeys: Record<DemountCompletionResolution, string> = {
  FULL_DEMOUNT: 'mobile.tasks.demount.descFull',
  REPLACE_SIM: 'mobile.tasks.demount.descReplace',
  REMOVE_SIM_ONLY: 'mobile.tasks.demount.descRemoveOnly',
};
const removedSimLabelKeys: Record<RemovedSimDisposition, string> = {
  MARK_DEFECTIVE: 'mobile.tasks.demount.dispDefective',
  RETURN_TO_STOCK: 'mobile.tasks.demount.dispReturn',
};
const meterCategoryLabelKeys: Record<MeterDemountCategory, string> = {
  METER_FAULTY: 'mobile.tasks.demount.catFaulty',
  TEMPORARY_REMOVAL: 'mobile.tasks.demount.catTemp',
  MAINTENANCE: 'mobile.tasks.demount.catMaintenance',
  OTHER: 'mobile.tasks.demount.catOther',
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
  const { t } = useTranslation();
  const { palette, type } = useTheme();
  const styles = useThemedStyles(createStyles);
  const search = useLocalSearchParams<{
    pickedIccid?: string | string[];
    wizardTaskId?: string | string[];
  }>();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<DemountTaskItem[]>([]);
  const [filter, setFilter] = useState<TaskFilter>('ACTIVE');
  const [pendingTaskIds, setPendingTaskIds] = useState<Set<string>>(new Set());
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [wizard, setWizard] = useState<DemountWizard | null>(null);
  const [wizardSubmitting, setWizardSubmitting] = useState(false);

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setIsRefreshing(true);
      else setIsLoading(true);
      setError(null);
      try {
        const data = await demountTasksApi.getMy();
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
            ? t('mobile.tasks.backendOfflineLocal')
            : t('mobile.tasks.demount.loadError'),
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [user, t],
  );

  useFocusEffect(
    useCallback(() => {
      void load(false);
    }, [load]),
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
        if (cancelled) return;
        setWizard((current) =>
          current?.task.id === rawTaskId
            ? {
                ...current,
                newSimCardId: card.id,
                newSimIccid: card.iccid,
                newSimIpAddress: card.ipAddress,
              }
            : current,
        );
      } catch {
        if (!cancelled) {
          Alert.alert(
            t('mobile.tasks.demount.scanFailedTitle'),
            t('mobile.tasks.demount.scanFailedMessage'),
          );
        }
      } finally {
        if (!cancelled) router.replace('/(app)/(tabs)/demount' as const);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [search.pickedIccid, search.wizardTaskId, router, t]);

  const filteredItems = useMemo(
    () => items.filter((item) => taskMatchesFilter(item.status, filter)),
    [items, filter],
  );

  const changeStatus = async (
    task: DemountTaskItem,
    status: DemountTaskStatus,
  ) => {
    setUpdatingId(task.id);
    try {
      await demountTasksApi.updateStatus(task.id, status);
      hapticSuccess();
      await load(true);
    } catch (err) {
      const message =
        axios.isAxiosError(err) && typeof err.response?.data?.message === 'string'
          ? err.response.data.message
          : t('mobile.tasks.statusUpdateFailed');
      Alert.alert(t('mobile.common.error'), message);
    } finally {
      setUpdatingId(null);
    }
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

  const updateWizard = (patch: Partial<DemountWizard>) =>
    setWizard((current) => (current ? { ...current, ...patch } : current));
  const scanNewSim = () => {
    if (!wizard) return;
    router.push({
      pathname: '/(app)/(tabs)/scan',
      params: { afterScan: 'demount', demountTaskId: wizard.task.id },
    });
  };

  const submitWizard = async () => {
    if (!wizard?.resolution) {
      Alert.alert(
        t('mobile.tasks.demount.missingChoiceTitle'),
        t('mobile.tasks.demount.missingResolution'),
      );
      return;
    }
    if (!wizard.removedSimDisposition) {
      Alert.alert(
        t('mobile.tasks.demount.missingChoiceTitle'),
        t('mobile.tasks.demount.missingDisposition'),
      );
      return;
    }
    const needsCategory =
      wizard.resolution === 'FULL_DEMOUNT' ||
      wizard.resolution === 'REMOVE_SIM_ONLY';
    if (needsCategory && !wizard.meterDemountCategory) {
      Alert.alert(
        t('mobile.tasks.demount.missingCategoryTitle'),
        t('mobile.tasks.demount.missingCategory'),
      );
      return;
    }
    if (wizard.resolution === 'REPLACE_SIM' && !wizard.newSimCardId) {
      Alert.alert(
        t('mobile.tasks.demount.missingNewSimTitle'),
        t('mobile.tasks.demount.missingNewSim'),
      );
      return;
    }
    const reason = wizard.reason.trim();
    if (!reason) {
      Alert.alert(
        t('mobile.tasks.demount.missingReasonTitle'),
        t('mobile.tasks.demount.missingReason'),
      );
      return;
    }

    setWizardSubmitting(true);
    try {
      await demountTasksApi.complete(wizard.task.id, {
        resolution: wizard.resolution,
        reason,
        removedSimDisposition: wizard.removedSimDisposition,
        ...(wizard.meterDemountCategory
          ? { meterDemountCategory: wizard.meterDemountCategory }
          : {}),
        ...(wizard.resolution === 'REPLACE_SIM' && wizard.newSimCardId
          ? { newSimCardId: wizard.newSimCardId }
          : {}),
      });
      hapticSuccess();
      setWizard(null);
      await load(true);
    } catch (err) {
      const message =
        axios.isAxiosError(err) && typeof err.response?.data?.message === 'string'
          ? err.response.data.message
          : t('mobile.tasks.completeFailed');
      Alert.alert(t('mobile.common.error'), message);
    } finally {
      setWizardSubmitting(false);
    }
  };

  const activeCount = items.filter(
    (item) => item.status === 'PENDING' || item.status === 'IN_PROGRESS',
  ).length;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenTitleBar
        title={t('mobile.tasks.demount.title')}
        subtitle={t('mobile.tasks.activeCountSubtitle', { count: activeCount })}
        actionIcon="refresh"
        actionLabel={t('mobile.common.refresh')}
        onAction={() => void load(true)}
      />
      <TaskFilterBar
        testID="demount-filter-bar"
        value={filter}
        onChange={setFilter}
        counts={{ active: activeCount }}
      />
      {isLoading ? (
        <View style={styles.loading}>
          <SkeletonRows count={5} />
        </View>
      ) : error ? (
        <View style={styles.stateWrap}>
          <Panel tone="danger">
            <Text style={styles.errorTitle}>
              {t('mobile.tasks.unavailableTitle')}
            </Text>
            <Text style={styles.errorText}>{error}</Text>
            <ActionButton
              title={t('mobile.common.retry')}
              icon="refresh"
              onPress={() => void load(true)}
            />
          </Panel>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => void load(true)}
              colors={[palette.brandText]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="checkmark-done-circle-outline"
              title={
                filter === 'ACTIVE'
                  ? t('mobile.tasks.emptyAllDone')
                  : t('mobile.tasks.emptyNoFilter')
              }
              description={
                filter === 'ACTIVE'
                  ? t('mobile.tasks.demount.emptyDesc')
                  : t('mobile.tasks.emptyFilterHint')
              }
            />
          }
          renderItem={({ item }) => (
            <TaskCard
              testID={`demount-task-card-${item.id}`}
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
              metadata={[
                ...(item.meter?.simCard
                  ? [
                      {
                        label: 'SIM / IP',
                        value: `${item.meter.simCard.iccid} · ${item.meter.simCard.ipAddress}`,
                      },
                    ]
                  : []),
                ...(item.meter?.meterTypeDefinition?.name
                  ? [
                      {
                        label: t('mobile.tasks.install.meterType'),
                        value: item.meter.meterTypeDefinition.name,
                      },
                    ]
                  : []),
                ...(item.completionResolution && item.status === 'COMPLETED'
                  ? [
                      {
                        label: t('mobile.tasks.demount.resolutionMetaLabel'),
                        value: t(resolutionLabelKeys[item.completionResolution]),
                      },
                    ]
                  : []),
              ]}
              updating={updatingId === item.id}
              primaryLabel={
                item.status === 'PENDING'
                  ? t('mobile.tasks.startTask')
                  : item.status === 'IN_PROGRESS'
                    ? t('mobile.tasks.demount.finishTask')
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
                item.status === 'IN_PROGRESS'
                  ? t('mobile.tasks.returnToInitiator')
                  : undefined
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
        title={t('mobile.tasks.demount.wizardTitle')}
        subtitle={
          wizard
            ? t('mobile.tasks.demount.wizardSubtitle', {
                meter: wizard.task.meter?.serialNumber ?? wizard.task.meterId,
              })
            : undefined
        }
        onClose={() => setWizard(null)}
        footer={
          wizard?.step === 2 ? (
            <ActionButton
              testID="demount-wizard-submit-btn"
              title={t('mobile.tasks.demount.wizardConfirm')}
              icon="checkmark"
              onPress={() => void submitWizard()}
              loading={wizardSubmitting}
              size="lg"
            />
          ) : undefined
        }
      >
        {wizard ? (
          <>
            <WorkflowSteps
              header={t('mobile.tasks.demount.wizardHeader')}
              steps={[
                {
                  key: 'task',
                  label: t('mobile.tasks.demount.stepTask'),
                  state: 'done',
                  detail:
                    wizard.task.meter?.serialNumber ?? wizard.task.meterId,
                },
                {
                  key: 'resolution',
                  label: t('mobile.tasks.demount.stepResolution'),
                  state: wizard.resolution ? 'done' : 'current',
                  detail: wizard.resolution
                    ? t(resolutionLabelKeys[wizard.resolution])
                    : undefined,
                },
                {
                  key: 'details',
                  label: t('mobile.tasks.demount.stepDetails'),
                  state: wizard.step === 2 ? 'current' : 'pending',
                },
                {
                  key: 'confirm',
                  label: t('mobile.tasks.demount.stepConfirm'),
                  state: 'pending',
                },
              ]}
            />

            {wizard.step === 1 ? (
              <>
                <Text style={[type.sectionLabel, styles.sectionTitle]}>
                  {t('mobile.tasks.demount.selectResolution')}
                </Text>
                {(
                  Object.keys(
                    resolutionLabelKeys,
                  ) as DemountCompletionResolution[]
                ).map((key) => (
                  <ChoiceRow
                    key={key}
                    label={t(resolutionLabelKeys[key])}
                    description={t(resolutionDescKeys[key])}
                    selected={wizard.resolution === key}
                    onPress={() => updateWizard({ resolution: key, step: 2 })}
                  />
                ))}
              </>
            ) : (
              <>
                {!wizard.isLocked ? (
                  <ActionButton
                    title={t('mobile.tasks.demount.changeResolution')}
                    variant="ghost"
                    icon="arrow-back"
                    onPress={() => updateWizard({ step: 1 })}
                    style={styles.backAction}
                  />
                ) : null}
                <Text style={[type.sectionLabel, styles.sectionTitle]}>
                  {t('mobile.tasks.demount.stepResolution')}
                </Text>
                <Panel tone="info">
                  <Text style={type.bodyStrong}>
                    {wizard.resolution
                      ? t(resolutionLabelKeys[wizard.resolution])
                      : '—'}
                  </Text>
                  {wizard.isLocked ? (
                    <Text style={[type.caption, styles.lockedText]}>
                      {t('mobile.tasks.demount.lockedByInitiator')}
                    </Text>
                  ) : null}
                </Panel>

                <Text style={[type.sectionLabel, styles.sectionTitle]}>
                  {t('mobile.tasks.demount.removedSimDisposition')}
                </Text>
                {wizard.isLocked ? (
                  <Panel>
                    <Text style={type.bodyStrong}>
                      {wizard.removedSimDisposition
                        ? t(removedSimLabelKeys[wizard.removedSimDisposition])
                        : '—'}
                    </Text>
                  </Panel>
                ) : (
                  (
                    Object.keys(removedSimLabelKeys) as RemovedSimDisposition[]
                  ).map((key) => (
                    <ChoiceRow
                      key={key}
                      label={t(removedSimLabelKeys[key])}
                      selected={wizard.removedSimDisposition === key}
                      onPress={() =>
                        updateWizard({ removedSimDisposition: key })
                      }
                    />
                  ))
                )}

                {wizard.resolution === 'FULL_DEMOUNT' ||
                wizard.resolution === 'REMOVE_SIM_ONLY' ? (
                  <>
                    <Text style={[type.sectionLabel, styles.sectionTitle]}>
                      {t('mobile.tasks.demount.categoryLabel')}
                    </Text>
                    {wizard.isLocked ? (
                      <Panel>
                        <Text style={type.bodyStrong}>
                          {wizard.meterDemountCategory
                            ? t(
                                meterCategoryLabelKeys[
                                  wizard.meterDemountCategory
                                ],
                              )
                            : '—'}
                        </Text>
                      </Panel>
                    ) : (
                      (
                        Object.keys(
                          meterCategoryLabelKeys,
                        ) as MeterDemountCategory[]
                      ).map((key) => (
                        <ChoiceRow
                          key={key}
                          label={t(meterCategoryLabelKeys[key])}
                          selected={wizard.meterDemountCategory === key}
                          onPress={() =>
                            updateWizard({ meterDemountCategory: key })
                          }
                        />
                      ))
                    )}
                  </>
                ) : null}

                {wizard.resolution === 'REPLACE_SIM' ? (
                  <>
                    <Text style={[type.sectionLabel, styles.sectionTitle]}>
                      {t('mobile.tasks.demount.newSimSection')}
                    </Text>
                    <Panel tone={wizard.newSimCardId ? 'success' : 'info'}>
                      {wizard.newSimIccid ? (
                        <>
                          <Text style={type.dataLarge}>
                            {wizard.newSimIccid}
                          </Text>
                          <Text style={[type.dataSmall, styles.ipText]}>
                            IP {wizard.newSimIpAddress?.trim() || '—'}
                          </Text>
                        </>
                      ) : (
                        <Text style={type.body}>
                          {t('mobile.tasks.demount.newSimPrompt')}
                        </Text>
                      )}
                      <ActionButton
                        testID="demount-wizard-scan-sim-btn"
                        title={
                          wizard.newSimCardId
                            ? t('mobile.tasks.demount.changeNewSim')
                            : t('mobile.tasks.demount.scanNewSim')
                        }
                        icon="barcode-outline"
                        onPress={scanNewSim}
                        variant={wizard.newSimCardId ? 'secondary' : 'primary'}
                        style={styles.panelAction}
                      />
                    </Panel>
                  </>
                ) : null}

                <Text style={[type.sectionLabel, styles.sectionTitle]}>
                  {t('mobile.tasks.demount.reasonSection')}
                </Text>
                <Field
                  label={t('mobile.tasks.demount.reasonLabel')}
                  required
                  value={wizard.reason}
                  onChangeText={(value) => updateWizard({ reason: value })}
                  placeholder={t('mobile.tasks.demount.reasonPlaceholder')}
                  multiline
                />

                <Text style={[type.sectionLabel, styles.sectionTitle]}>
                  {t('mobile.tasks.demount.currentMeterSection')}
                </Text>
                <Panel padding="none">
                  <View style={styles.panelInner}>
                    <ListRow
                      title={t('mobile.tasks.install.serialNumber')}
                      value={
                        wizard.task.meter?.serialNumber ?? wizard.task.meterId
                      }
                      valueMono
                    />
                    {wizard.task.meter?.simCard ? (
                      <ListRow
                        title={t('mobile.tasks.demount.installedSim')}
                        value={wizard.task.meter.simCard.iccid}
                        valueMono
                        divider
                      />
                    ) : null}
                  </View>
                </Panel>
              </>
            )}
          </>
        ) : null}
      </WorkflowModal>
    </SafeAreaView>
  );
}

const createStyles = (palette: ThemePalette, type: ThemeTypography) => ({
  root: { flex: 1, backgroundColor: palette.background },
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
  backAction: { alignSelf: 'flex-start' as const, marginTop: spacing.sm },
  lockedText: { marginTop: spacing.xs },
  ipText: { marginTop: spacing.xs },
  panelAction: { marginTop: spacing.lg },
  panelInner: { paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
});
