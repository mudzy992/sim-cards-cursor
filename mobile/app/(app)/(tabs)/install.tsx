import axios from 'axios'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { installTasksApi, type InstallTaskItem, type InstallTaskStatus } from '@/api/install-tasks.api'
import { simCardsApi } from '@/api/sim-cards.api'
import { useAuthStore } from '@/store/auth.store'
import { listOutbox } from '@/offline/outbox'
import { colors } from '@/theme/colors'

const statusLabels: Record<InstallTaskStatus, string> = {
  PENDING: 'Čeka',
  IN_PROGRESS: 'U toku',
  COMPLETED: 'Završeno',
  CANCELLED: 'Otkazano',
}

const statusActions: Record<InstallTaskStatus, InstallTaskStatus[]> = {
  PENDING: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['CANCELLED'],
  COMPLETED: [],
  CANCELLED: ['PENDING'],
}

export default function InstallScreen() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const search = useLocalSearchParams<{ pickedIccid?: string; wizardTaskId?: string }>()
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<InstallTaskItem[]>([])
  const [pendingTaskIds, setPendingTaskIds] = useState<Set<string>>(new Set())
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [wizard, setWizard] = useState<{
    task: InstallTaskItem
    pickedSimCardId?: string
    pickedSimIccid?: string
    recordNotes: string
  } | null>(null)
  const [wizardSubmitting, setWizardSubmitting] = useState(false)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true)
    else setIsLoading(true)
    setError(null)
    try {
      const data = await installTasksApi.getMy()
      setItems(data)
      if (user) {
        const outbox = await listOutbox(user)
        const ids = new Set(outbox.map((i) => i.meta?.taskId).filter(Boolean) as string[])
        setPendingTaskIds(ids)
      } else {
        setPendingTaskIds(new Set())
      }
    } catch (err) {
      if (axios.isAxiosError(err) && !err.response) {
        setError('Backend nije dostupan.')
      } else {
        setError('Nije moguće učitati zadatke ugradnje.')
      }
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [user])

  useFocusEffect(
    useCallback(() => {
      void load(false)
    }, [load]),
  )

  useEffect(() => {
    const rawIccid =
      typeof search.pickedIccid === 'string'
        ? search.pickedIccid
        : search.pickedIccid?.[0]
    const rawTaskId =
      typeof search.wizardTaskId === 'string'
        ? search.wizardTaskId
        : search.wizardTaskId?.[0]
    if (!rawIccid?.trim() || !rawTaskId) {
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const card = await simCardsApi.scanByIccidWithOffline(rawIccid.trim())
        if (cancelled) return
        setWizard((w) => {
          if (!w || w.task.id !== rawTaskId) return w
          return {
            ...w,
            pickedSimCardId: card.id,
            pickedSimIccid: card.iccid,
          }
        })
      } catch {
        if (!cancelled) {
          Alert.alert('Greška', 'Skenirana SIM nije pronađena ili nije dostupna.')
        }
      } finally {
        if (!cancelled) {
          router.replace('/(app)/(tabs)/install' as const)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [search.pickedIccid, search.wizardTaskId, router])

  const handleStatusChange = async (task: InstallTaskItem, newStatus: InstallTaskStatus) => {
    setUpdatingId(task.id)
    try {
      await installTasksApi.updateStatus(task.id, newStatus)
      void load(true)
    } catch (err) {
      const msg =
        axios.isAxiosError(err) && typeof err.response?.data?.message === 'string'
          ? err.response.data.message
          : 'Ažuriranje statusa nije uspjelo.'
      Alert.alert('Greška', msg)
    } finally {
      setUpdatingId(null)
    }
  }

  const handleOpenWizard = (task: InstallTaskItem) => {
    setWizard({ task, recordNotes: '' })
  }

  const handleScanSim = () => {
    if (!wizard) return
    router.push({
      pathname: '/(app)/(tabs)/scan',
      params: { afterScan: 'install', installTaskId: wizard.task.id },
    })
  }

  const handleWizardSubmit = async () => {
    if (!wizard?.pickedSimCardId) {
      Alert.alert('SIM', 'Skenirajte SIM karticu koju ugrađujete.')
      return
    }
    setWizardSubmitting(true)
    try {
      await installTasksApi.complete(wizard.task.id, {
        simCardId: wizard.pickedSimCardId,
        recordNotes: wizard.recordNotes.trim() ? wizard.recordNotes.trim() : undefined,
      })
      setWizard(null)
      void load(true)
    } catch (err) {
      const msg =
        axios.isAxiosError(err) && typeof err.response?.data?.message === 'string'
          ? err.response.data.message
          : 'Završetak zadatka nije uspio.'
      Alert.alert('Greška', msg)
    } finally {
      setWizardSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 8 }}>
      <Text style={{ fontSize: 20, fontWeight: '700' }}>Ugradnja SIM</Text>
      <Text style={{ color: colors.textMuted }}>
        Zadaci koje je moderator poslao za brojila bez SIM kartice.
      </Text>

      {error ? (
        <View style={{ gap: 8 }}>
          <Text style={{ color: '#dc2626' }}>{error}</Text>
          <Pressable
            onPress={() => void load(true)}
            style={{
              alignSelf: 'flex-start',
              backgroundColor: colors.primary,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: '#fff' }}>Pokušaj ponovo</Text>
          </Pressable>
        </View>
      ) : null}

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => void load(true)} />
        }
        ListEmptyComponent={
          <Text style={{ color: '#64748b', marginTop: 24, textAlign: 'center' }}>
            Nema zadataka ugradnje.
          </Text>
        }
        renderItem={({ item }) => (
          <View
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 10,
              padding: 12,
              marginBottom: 8,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontWeight: '700', fontSize: 16 }}>
                  {item.meter?.serialNumber ?? 'Brojilo'}
                </Text>
                {pendingTaskIds.has(item.id) ? (
                  <View style={{ backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#991b1b' }}>
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
                  borderRadius: 6,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
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

            {item.notes ? (
              <Text style={{ color: '#64748b', fontSize: 13, marginBottom: 4 }}>
                Napomena: {item.notes}
              </Text>
            ) : null}

            {item.installationRecord?.recordNumber && item.status === 'COMPLETED' ? (
              <Text style={{ color: '#166534', fontSize: 13 }}>
                Zapisnik: {item.installationRecord.recordNumber}
              </Text>
            ) : null}

            {item.status === 'IN_PROGRESS' ? (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <Pressable
                  disabled={updatingId === item.id}
                  onPress={() => handleOpenWizard(item)}
                  style={({ pressed }) => ({
                    backgroundColor: pressed ? colors.primaryPressed : colors.primary,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                    opacity: updatingId === item.id ? 0.7 : 1,
                  })}
                >
                  <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>
                    Završi ugradnju
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
                      borderRadius: 8,
                      opacity: updatingId === item.id ? 0.7 : 1,
                    })}
                  >
                    {updatingId === item.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>
                        Otkaži
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
                      borderRadius: 8,
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
                            : 'Vrati na čekanje'}
                      </Text>
                    )}
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
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
          <View
            style={{
              backgroundColor: '#fff',
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              maxHeight: '88%',
              padding: 16,
              gap: 12,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 18, fontWeight: '700' }}>Završetak ugradnje</Text>
              <Pressable onPress={() => setWizard(null)} hitSlop={12} accessibilityLabel="Zatvori">
                <Ionicons name="close" size={26} color="#64748b" />
              </Pressable>
            </View>
            {wizard ? (
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12 }}>
                <Text style={{ color: colors.textMuted }}>
                  Brojilo: {wizard.task.meter?.serialNumber ?? wizard.task.meterId}
                </Text>
                <View style={{ gap: 8 }}>
                  <Text style={{ fontWeight: '600' }}>SIM kartica</Text>
                  {wizard.pickedSimIccid ? (
                    <Text style={{ color: '#166534' }}>Odabrano: {wizard.pickedSimIccid}</Text>
                  ) : (
                    <Text style={{ color: colors.textMuted }}>
                      Skenirajte karticu koja će biti ugrađena.
                    </Text>
                  )}
                  <Pressable
                    onPress={handleScanSim}
                    style={({ pressed }) => ({
                      alignSelf: 'flex-start',
                      backgroundColor: pressed ? colors.primaryPressed : colors.primary,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 8,
                    })}
                  >
                    <Text style={{ color: '#fff', fontWeight: '600' }}>Skeniraj SIM</Text>
                  </Pressable>
                </View>
                <View style={{ gap: 8 }}>
                  <Text style={{ fontWeight: '600' }}>Napomena (zapisnik)</Text>
                  <TextInput
                    value={wizard.recordNotes}
                    onChangeText={(text) => setWizard((w) => (w ? { ...w, recordNotes: text } : w))}
                    placeholder="Opcionalno"
                    multiline
                    numberOfLines={3}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 10,
                      padding: 12,
                      minHeight: 80,
                      textAlignVertical: 'top',
                    }}
                  />
                </View>
                <Pressable
                  disabled={wizardSubmitting}
                  onPress={() => void handleWizardSubmit()}
                  style={({ pressed }) => ({
                    backgroundColor: pressed ? colors.primaryPressed : colors.primary,
                    padding: 14,
                    borderRadius: 10,
                    alignItems: 'center',
                    opacity: wizardSubmitting ? 0.7 : 1,
                  })}
                >
                  {wizardSubmitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Potvrdi ugradnju</Text>
                  )}
                </Pressable>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  )
}

