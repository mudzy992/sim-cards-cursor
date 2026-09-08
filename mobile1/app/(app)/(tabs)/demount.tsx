import axios from 'axios';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  demountTasksApi,
  type DemountCompletionResolution,
  type DemountTaskItem,
  type DemountTaskStatus,
  type MeterDemountCategory,
  type RemovedSimDisposition,
} from '@/api/demount-tasks.api';
import { simCardsApi } from '@/api/sim-cards.api';
import { useAuthStore } from '@/store/auth.store'
import { listOutbox } from '@/offline/outbox'
import { colors } from '@/theme/colors';
import { ScreenHeader } from '@/components/common/ScreenHeader'
import { Card } from '@/components/common/Card'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const statusLabels: Record<DemountTaskStatus, string> = {
  PENDING: 'Čeka',
  IN_PROGRESS: 'U toku',
  COMPLETED: 'Završeno',
  CANCELLED: 'Otkazano',
};

const statusActions: Record<DemountTaskStatus, DemountTaskStatus[]> = {
  PENDING: ['IN_PROGRESS'],
  IN_PROGRESS: ['PENDING'],
  COMPLETED: [],
  CANCELLED: [],
};

const resolutionLabels: Record<DemountCompletionResolution, string> = {
  FULL_DEMOUNT: 'Potpuna demontaža (brojilo + SIM)',
  REPLACE_SIM: 'Demontaža SIM-a i zamjena novom',
  REMOVE_SIM_ONLY: 'Demontaža SIM-a bez zamjene (NO_SIM)',
};

const removedSimLabels: Record<RemovedSimDisposition, string> = {
  MARK_DEFECTIVE: 'Uklonjena SIM je neispravna (označi kao neispravnu)',
  RETURN_TO_STOCK: 'Uklonjena SIM je ispravna (vrati u zalihe za drugo brojilo)',
};

const meterDemountLabels: Record<MeterDemountCategory, string> = {
  METER_FAULTY: 'Brojilo neispravno',
  TEMPORARY_REMOVAL: 'Privremena demontaža SIM-a',
  MAINTENANCE: 'Servis / održavanje',
  OTHER: 'Ostalo',
};

export default function DemountScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user)
  const insets = useSafeAreaInsets()
  const search = useLocalSearchParams<{ pickedIccid?: string; wizardTaskId?: string }>();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<DemountTaskItem[]>([]);
  const [pendingTaskIds, setPendingTaskIds] = useState<Set<string>>(new Set())
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [wizard, setWizard] = useState<{
    task: DemountTaskItem;
    step: 1 | 2;
    isLocked: boolean;
    resolution?: DemountCompletionResolution;
    reason: string;
    newSimCardId?: string;
    newSimIccid?: string;
    newSimIpAddress?: string;
    removedSimDisposition?: RemovedSimDisposition;
    meterDemountCategory?: MeterDemountCategory;
  } | null>(null);
  const [wizardSubmitting, setWizardSubmitting] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);
    try {
      const data = await demountTasksApi.getMy();
      setItems(data);
      if (user) {
        const outbox = await listOutbox(user)
        const ids = new Set(outbox.map((i) => i.meta?.taskId).filter(Boolean) as string[])
        setPendingTaskIds(ids)
      } else {
        setPendingTaskIds(new Set())
      }
    } catch (err) {
      if (axios.isAxiosError(err) && !err.response) {
        setError('Backend nije dostupan.');
      } else {
        setError('Nije moguće učitati zadatke demontaže.');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user]);

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
    if (!rawIccid?.trim() || !rawTaskId) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const card = await simCardsApi.scanByIccidWithOffline(rawIccid.trim());
        if (cancelled) return;
        setWizard((w) => {
          if (!w || w.task.id !== rawTaskId) return w;
          return {
            ...w,
            newSimCardId: card.id,
            newSimIccid: card.iccid,
            newSimIpAddress: card.ipAddress,
          };
        });
      } catch {
        if (!cancelled) {
          Alert.alert('Greška', 'Skenirana SIM nije pronađena ili nije dostupna.');
        }
      } finally {
        if (!cancelled) {
          router.replace('/(app)/(tabs)/demount' as const);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [search.pickedIccid, search.wizardTaskId, router]);

  const handleStatusChange = async (task: DemountTaskItem, newStatus: DemountTaskStatus) => {
    setUpdatingId(task.id);
    try {
      await demountTasksApi.updateStatus(task.id, newStatus);
      void load(true);
    } catch (err) {
      const msg =
        axios.isAxiosError(err) && typeof err.response?.data?.message === 'string'
          ? err.response.data.message
          : 'Ažuriranje statusa nije uspjelo.';
      Alert.alert('Greška', msg);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleOpenWizard = (task: DemountTaskItem) => {
    const isLocked = Boolean(task.requestedResolution)
    setWizard({
      task,
      step: isLocked ? 2 : 1,
      isLocked,
      resolution: task.requestedResolution ?? undefined,
      reason: task.requestedReason ?? '',
      removedSimDisposition: task.requestedRemovedSimDisposition ?? undefined,
      meterDemountCategory: task.requestedMeterDemountCategory ?? undefined,
      newSimCardId: undefined,
      newSimIccid: undefined,
      newSimIpAddress: undefined,
    });
  };

  const handleWizardSubmit = async () => {
    if (!wizard?.resolution) {
      Alert.alert('Nedostaje izbor', 'Odaberite tip završetka.');
      return;
    }
    const reason = wizard.reason.trim();
    if (reason.length < 3) {
      Alert.alert('Obrazloženje', 'Unesite obrazloženje (najmanje 3 znaka).');
      return;
    }
    if (wizard.resolution === 'REPLACE_SIM' && !wizard.newSimCardId) {
      Alert.alert('Nova SIM', 'Skenirajte ili učitajte novu SIM karticu.');
      return;
    }
    if (!wizard.removedSimDisposition) {
      Alert.alert('SIM', 'Odaberite šta se dešava sa uklonjenom SIM karticom.');
      return;
    }
    if (
      (wizard.resolution === 'FULL_DEMOUNT' || wizard.resolution === 'REMOVE_SIM_ONLY') &&
      !wizard.meterDemountCategory
    ) {
      Alert.alert('Brojilo', 'Odaberite kategoriju demontaže brojila (bez SIM-a).');
      return;
    }
    setWizardSubmitting(true);
    try {
      await demountTasksApi.complete(wizard.task.id, {
        resolution: wizard.resolution,
        reason,
        removedSimDisposition: wizard.removedSimDisposition,
        ...(wizard.resolution === 'FULL_DEMOUNT' || wizard.resolution === 'REMOVE_SIM_ONLY'
          ? { meterDemountCategory: wizard.meterDemountCategory! }
          : {}),
        ...(wizard.resolution === 'REPLACE_SIM' && wizard.newSimCardId
          ? { newSimCardId: wizard.newSimCardId }
          : {}),
      });
      setWizard(null);
      void load(true);
    } catch (err) {
      const msg =
        axios.isAxiosError(err) && typeof err.response?.data?.message === 'string'
          ? err.response.data.message
          : 'Završetak zadatka nije uspio.';
      Alert.alert('Greška', msg);
    } finally {
      setWizardSubmitting(false);
    }
  };

  const handleScanNewSim = () => {
    if (!wizard) return;
    router.push({
      pathname: '/(app)/(tabs)/scan',
      params: { afterScan: 'demount', demountTaskId: wizard.task.id },
    });
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Zadaci demontaže"
        subtitle="Završetak ide kroz wizard: tip, obrazloženje, opcionalno sken nove SIM."
      />

      {error ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 14, gap: 8 }}>
          <Text style={{ color: colors.danger, fontWeight: '700' }}>{error}</Text>
          <Pressable
            onPress={() => void load(true)}
            style={{
              alignSelf: 'flex-start',
              backgroundColor: colors.primary,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 10,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '800' }}>Pokušaj ponovo</Text>
          </Pressable>
        </View>
      ) : null}

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 20 }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => void load(true)} />
        }
        ListEmptyComponent={
          <Text style={{ color: colors.textMuted, marginTop: 24, textAlign: 'center' }}>
            Nema zadataka demontaže.
          </Text>
        }
        renderItem={({ item }) => (
          <Card style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontWeight: '800', fontSize: 16, color: colors.text }}>
                  {item.meter?.serialNumber ?? 'Brojilo'}
                </Text>
                {pendingTaskIds.has(item.id) ? (
                  <View style={{ backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#991b1b' }}>
                      Neposlato
                    </Text>
                  </View>
                ) : null}
              </View>
              <View
                style={{
                  backgroundColor:
                    item.status === 'COMPLETED'
                      ? '#dcfce7'
                      : item.status === 'CANCELLED'
                        ? '#fee2e2'
                        : '#fef3c7',
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '800',
                    color:
                      item.status === 'COMPLETED'
                        ? '#166534'
                        : item.status === 'CANCELLED'
                          ? '#991b1b'
                          : '#92400e',
                  }}
                >
                  {statusLabels[item.status]}
                </Text>
              </View>
            </View>
            {item.completionResolution && item.status === 'COMPLETED' ? (
              <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 4 }}>
                Način: {resolutionLabels[item.completionResolution]}
              </Text>
            ) : null}
            {item.meter?.simCard && (
              <Text style={{ color: colors.textMuted, fontSize: 14 }}>
                SIM: {item.meter.simCard.iccid} • IP: {item.meter.simCard.ipAddress}
              </Text>
            )}
            {item.meter?.meterTypeDefinition && (
              <Text style={{ color: colors.textMuted, fontSize: 14 }}>
                Tip: {item.meter.meterTypeDefinition.name}
              </Text>
            )}
            {item.status === 'IN_PROGRESS' ? (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <Pressable
                  disabled={updatingId === item.id}
                  onPress={() => handleOpenWizard(item)}
                  style={({ pressed }) => ({
                    backgroundColor: pressed ? colors.primaryPressed : colors.primary,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 10,
                    opacity: updatingId === item.id ? 0.7 : 1,
                  })}
                >
                  <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>
                    Završi demontažu
                  </Text>
                </Pressable>
                {statusActions[item.status].map((status) => (
                  <Pressable
                    key={status}
                    disabled={updatingId === item.id}
                    onPress={() => handleStatusChange(item, status)}
                    style={({ pressed }) => ({
                      backgroundColor: pressed ? '#94a3b8' : '#64748b',
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 10,
                      opacity: updatingId === item.id ? 0.7 : 1,
                    })}
                  >
                    {updatingId === item.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>
                        Vrati inicijatoru
                      </Text>
                    )}
                  </Pressable>
                ))}
              </View>
            ) : null}
            {item.status !== 'IN_PROGRESS' && statusActions[item.status].length > 0 ? (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                {statusActions[item.status].map((status) => (
                  <Pressable
                    key={status}
                    disabled={updatingId === item.id}
                    onPress={() => handleStatusChange(item, status)}
                    style={({ pressed }) => ({
                      backgroundColor: pressed ? colors.primaryPressed : colors.primary,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 10,
                      opacity: updatingId === item.id ? 0.7 : 1,
                    })}
                  >
                    {updatingId === item.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>
                        {status === 'IN_PROGRESS'
                          ? 'Započni'
                          : status === 'CANCELLED'
                            ? 'Otkaži'
                            : 'Vrati inicijatoru'}
                      </Text>
                    )}
                  </Pressable>
                ))}
              </View>
            ) : null}
          </Card>
        )}
      />

      <Modal visible={wizard !== null} animationType="slide" transparent>
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(15,23,42,0.45)',
            justifyContent: 'flex-end',
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
            keyboardVerticalOffset={0}
          >
            <View
              style={{
                backgroundColor: colors.surface,
                borderTopLeftRadius: 18,
                borderTopRightRadius: 18,
                maxHeight: '88%',
                padding: 16,
                paddingBottom: 16 + insets.bottom,
                gap: 12,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>Završetak demontaže</Text>
                <Pressable
                  onPress={() => setWizard(null)}
                  hitSlop={12}
                  accessibilityLabel="Zatvori"
                >
                  <Ionicons name="close" size={26} color={colors.textMuted} />
                </Pressable>
              </View>
              {wizard ? (
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ gap: 12, paddingBottom: 20 + insets.bottom }}
                >
                <Text style={{ color: colors.textMuted }}>
                  Brojilo: {wizard.task.meter?.serialNumber ?? wizard.task.meterId}
                </Text>
                {wizard.step === 1 ? (
                  <View style={{ gap: 10 }}>
                    <Text style={{ fontWeight: '600' }}>Odaberite rezoluciju</Text>
                    {(Object.keys(resolutionLabels) as DemountCompletionResolution[]).map((key) => (
                      <Pressable
                        key={key}
                        onPress={() =>
                          setWizard((w) => (w ? { ...w, resolution: key, step: 2 } : w))
                        }
                        style={({ pressed }) => ({
                          borderWidth: 1,
                          borderColor: wizard.resolution === key ? colors.primary : colors.border,
                          backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
                          padding: 12,
                          borderRadius: 12,
                        })}
                      >
                        <Text style={{ fontWeight: '600' }}>{resolutionLabels[key]}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <View style={{ gap: 12 }}>
                    {!wizard.isLocked ? (
                      <Pressable onPress={() => setWizard((w) => (w ? { ...w, step: 1 } : w))}>
                        <Text style={{ color: colors.primary, fontWeight: '600' }}>← Nazad</Text>
                      </Pressable>
                    ) : null}

                    <Text style={{ fontWeight: '600' }}>Rezolucija (inicijator)</Text>
                    <Text style={{ color: colors.textMuted }}>
                      {wizard.resolution ? resolutionLabels[wizard.resolution] : '—'}
                    </Text>

                    <Text style={{ fontWeight: '600' }}>Ishod uklonjene SIM (inicijator)</Text>
                    {wizard.isLocked ? (
                      <Text style={{ color: colors.textMuted }}>
                        {wizard.removedSimDisposition ? removedSimLabels[wizard.removedSimDisposition] : '—'}
                      </Text>
                    ) : (
                      (Object.keys(removedSimLabels) as RemovedSimDisposition[]).map((key) => (
                        <Pressable
                          key={key}
                          onPress={() =>
                            setWizard((w) => (w ? { ...w, removedSimDisposition: key } : w))
                          }
                          style={({ pressed }) => ({
                            borderWidth: 1,
                            borderColor: wizard.removedSimDisposition === key ? colors.primary : colors.border,
                            backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
                            padding: 12,
                            borderRadius: 12,
                          })}
                        >
                          <Text style={{ fontWeight: '600', fontSize: 13 }}>{removedSimLabels[key]}</Text>
                        </Pressable>
                      ))
                    )}
                    {wizard.resolution &&
                    (wizard.resolution === 'FULL_DEMOUNT' ||
                      wizard.resolution === 'REMOVE_SIM_ONLY') ? (
                      <View style={{ gap: 10 }}>
                        <Text style={{ fontWeight: '600' }}>Brojilo ostaje bez SIM-a — kategorija</Text>
                        {wizard.isLocked ? (
                          <Text style={{ color: colors.textMuted }}>
                            {wizard.meterDemountCategory ? meterDemountLabels[wizard.meterDemountCategory] : '—'}
                          </Text>
                        ) : (
                          (Object.keys(meterDemountLabels) as MeterDemountCategory[]).map((key) => (
                            <Pressable
                              key={key}
                              onPress={() =>
                                setWizard((w) => (w ? { ...w, meterDemountCategory: key } : w))
                              }
                              style={({ pressed }) => ({
                                borderWidth: 1,
                                borderColor: wizard.meterDemountCategory === key ? colors.primary : colors.border,
                                backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
                                padding: 12,
                                borderRadius: 12,
                              })}
                            >
                              <Text style={{ fontWeight: '600', fontSize: 13 }}>{meterDemountLabels[key]}</Text>
                            </Pressable>
                          ))
                        )}
                      </View>
                    ) : null}
                    <Text style={{ fontWeight: '600' }}>Obrazloženje</Text>
                    <TextInput
                      value={wizard.reason}
                      editable={!wizard.isLocked}
                      onChangeText={(text) => setWizard((w) => (w ? { ...w, reason: text } : w))}
                      placeholder="Opišite razlog demontaže / zamjene"
                      multiline
                      numberOfLines={4}
                      style={{
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 12,
                        padding: 12,
                        minHeight: 100,
                        textAlignVertical: 'top',
                        backgroundColor: colors.surface,
                      }}
                    />
                    {wizard.resolution === 'REPLACE_SIM' ? (
                      <View style={{ gap: 8 }}>
                        <Text style={{ fontWeight: '600' }}>Nova SIM</Text>
                        {wizard.newSimIccid ? (
                          <Text style={{ color: '#166534' }}>
                            Odabrano: {wizard.newSimIccid} • IP: {wizard.newSimIpAddress?.trim() || '–'}
                          </Text>
                        ) : (
                          <Text style={{ color: colors.textMuted }}>
                            Skenirajte karticu koja će zamijeniti staru.
                          </Text>
                        )}
                        <Pressable
                          onPress={handleScanNewSim}
                          style={({ pressed }) => ({
                            alignSelf: 'flex-start',
                            backgroundColor: pressed ? colors.primaryPressed : colors.primary,
                            paddingHorizontal: 14,
                            paddingVertical: 10,
                            borderRadius: 10,
                          })}
                        >
                          <Text style={{ color: '#fff', fontWeight: '600' }}>Skeniraj novu SIM</Text>
                        </Pressable>
                      </View>
                    ) : null}
                    <Pressable
                      disabled={wizardSubmitting}
                      onPress={() => void handleWizardSubmit()}
                      style={({ pressed }) => ({
                        backgroundColor: pressed ? colors.primaryPressed : colors.primary,
                        padding: 14,
                        borderRadius: 12,
                        alignItems: 'center',
                        opacity: wizardSubmitting ? 0.7 : 1,
                      })}
                    >
                      {wizardSubmitting ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={{ color: '#fff', fontWeight: '700' }}>Potvrdi završetak</Text>
                      )}
                    </Pressable>
                  </View>
                )}
                </ScrollView>
              ) : null}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}
