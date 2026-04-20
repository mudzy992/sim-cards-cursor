import axios from 'axios'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
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
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { installTasksApi, type InstallTaskItem, type InstallTaskStatus } from '@/api/install-tasks.api'
import { simCardsApi } from '@/api/sim-cards.api'
import { meterTypeDefinitionsApi, type MeterTypeFieldItem } from '@/api/meter-type-definitions.api'
import { useAuthStore } from '@/store/auth.store'
import { listOutbox } from '@/offline/outbox'
import { colors } from '@/theme/colors'
import { ScreenHeader } from '@/components/common/ScreenHeader'
import { Card } from '@/components/common/Card'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const statusLabels: Record<InstallTaskStatus, string> = {
  PENDING: 'Čeka',
  IN_PROGRESS: 'U toku',
  COMPLETED: 'Završeno',
  CANCELLED: 'Otkazano',
}

const statusActions: Record<InstallTaskStatus, InstallTaskStatus[]> = {
  PENDING: ['IN_PROGRESS'],
  IN_PROGRESS: ['PENDING'],
  COMPLETED: [],
  CANCELLED: [],
}

export default function InstallScreen() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const insets = useSafeAreaInsets()
  const search = useLocalSearchParams<{ pickedIccid?: string; wizardTaskId?: string }>()
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<InstallTaskItem[]>([])
  const [pendingTaskIds, setPendingTaskIds] = useState<Set<string>>(new Set())
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [wizardFields, setWizardFields] = useState<MeterTypeFieldItem[]>([])
  const [wizard, setWizard] = useState<{
    task: InstallTaskItem
    pickedSimCardId?: string
    pickedSimIccid?: string
    recordNotes: string
    calibrationYear: string
    installationAddress: string
    installationDate: string
    city: string
    municipality: string
    measuringPoint: string
    latitude: string
    longitude: string
    dynamicFieldValues: Record<string, unknown>
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
        const claimed = await simCardsApi.claimById(card.id)
        if (cancelled) return
        setWizard((w) => {
          if (!w || w.task.id !== rawTaskId) return w
          return {
            ...w,
            pickedSimCardId: claimed.id,
            pickedSimIccid: claimed.iccid,
          }
        })
      } catch {
        if (!cancelled) {
          Alert.alert(
            'Greška',
            'Skenirana SIM nije pronađena, nije dostupna za zaduživanje, ili zaduživanje nije uspjelo.',
          )
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
    const meter = task.meter
    const today = new Date().toISOString().slice(0, 10)
    setWizardFields([])
    setWizard({
      task,
      recordNotes: '',
      calibrationYear: meter?.calibrationYear != null ? String(meter.calibrationYear) : '',
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
        meter?.dynamicFieldValues && typeof meter.dynamicFieldValues === 'object'
          ? (meter.dynamicFieldValues as Record<string, unknown>)
          : {},
    })
  }

  useEffect(() => {
    if (!wizard?.task?.meter?.meterTypeDefinitionId) return
    let cancelled = false
    void (async () => {
      try {
        const fields = await meterTypeDefinitionsApi.listFields(wizard.task.meter!.meterTypeDefinitionId!)
        if (!cancelled) setWizardFields(fields)
      } catch {
        if (!cancelled) setWizardFields([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [wizard?.task?.meter?.meterTypeDefinitionId])

  const handleScanSim = () => {
    if (!wizard) return
    router.push({
      pathname: '/(app)/(tabs)/scan',
      params: { afterScan: 'install', installTaskId: wizard.task.id },
    })
  }

  const handleDynamicFieldChange = (fieldName: string, value: unknown) => {
    setWizard((w) => {
      if (!w) return w
      return {
        ...w,
        dynamicFieldValues: {
          ...w.dynamicFieldValues,
          [fieldName]: value,
        },
      }
    })
  }

  const handleWizardSubmit = async () => {
    if (!wizard?.pickedSimCardId) {
      Alert.alert('SIM', 'Skenirajte SIM karticu koju ugrađujete.')
      return
    }
    setWizardSubmitting(true)
    try {
      const meter = wizard.task.meter
      const demountedFromLocation = meter?.isDemountedFromLocation === true
      const calibrationYear =
        wizard.calibrationYear.trim() ? Number.parseInt(wizard.calibrationYear.trim(), 10) : undefined
      const latitude = wizard.latitude.trim() ? Number.parseFloat(wizard.latitude.trim()) : undefined
      const longitude = wizard.longitude.trim() ? Number.parseFloat(wizard.longitude.trim()) : undefined
      await installTasksApi.complete(wizard.task.id, {
        simCardId: wizard.pickedSimCardId,
        recordNotes: wizard.recordNotes.trim() ? wizard.recordNotes.trim() : undefined,
        ...(calibrationYear !== undefined ? { calibrationYear } : {}),
        ...(demountedFromLocation
          ? {
              installationAddress: wizard.installationAddress.trim() ? wizard.installationAddress.trim() : undefined,
              installationDate: wizard.installationDate.trim() ? wizard.installationDate.trim() : undefined,
              city: wizard.city.trim() ? wizard.city.trim() : undefined,
              municipality: wizard.municipality.trim() ? wizard.municipality.trim() : undefined,
              measuringPoint: wizard.measuringPoint.trim() ? wizard.measuringPoint.trim() : undefined,
              ...(latitude !== undefined ? { latitude } : {}),
              ...(longitude !== undefined ? { longitude } : {}),
            }
          : {}),
        ...(Object.keys(wizard.dynamicFieldValues ?? {}).length > 0
          ? { dynamicFieldValues: wizard.dynamicFieldValues }
          : {}),
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
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Ugradnja SIM"
        subtitle="Zadaci koje je moderator poslao za brojila bez SIM kartice."
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
            Nema zadataka ugradnje.
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

            <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 4 }}>
              Poslano: {new Date(item.createdAt).toLocaleString('bs-BA')}
              {item.createdBy
                ? ` • Poslao: ${item.createdBy.firstName} ${item.createdBy.lastName}`
                : ''}
            </Text>

            {item.notes ? (
              <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 4 }}>
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
                    borderRadius: 10,
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
                      borderRadius: 10,
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
                            : 'Vrati na čekanje'}
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
                <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>Završetak ugradnje</Text>
                <Pressable onPress={() => setWizard(null)} hitSlop={12} accessibilityLabel="Zatvori">
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
                {wizard.task.meter?.isDemountedFromLocation ? (
                  <View style={{ gap: 10 }}>
                    <Text style={{ fontWeight: '600' }}>Svježi podaci (brojilo demontirano sa lokacije)</Text>
                    <View style={{ gap: 6 }}>
                      <Text style={{ fontWeight: '600' }}>Adresa</Text>
                      <TextInput
                        value={wizard.installationAddress}
                        onChangeText={(text) => setWizard((w) => (w ? { ...w, installationAddress: text } : w))}
                        placeholder="Ulica i broj"
                        style={{
                          borderWidth: 1,
                          borderColor: colors.border,
                          borderRadius: 12,
                          padding: 12,
                          backgroundColor: colors.surface,
                        }}
                      />
                    </View>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ flex: 1, gap: 6 }}>
                        <Text style={{ fontWeight: '600' }}>Grad</Text>
                        <TextInput
                          value={wizard.city}
                          onChangeText={(text) => setWizard((w) => (w ? { ...w, city: text } : w))}
                          placeholder="Grad"
                          style={{
                            borderWidth: 1,
                            borderColor: colors.border,
                            borderRadius: 12,
                            padding: 12,
                            backgroundColor: colors.surface,
                          }}
                        />
                      </View>
                      <View style={{ flex: 1, gap: 6 }}>
                        <Text style={{ fontWeight: '600' }}>Općina</Text>
                        <TextInput
                          value={wizard.municipality}
                          onChangeText={(text) => setWizard((w) => (w ? { ...w, municipality: text } : w))}
                          placeholder="Općina"
                          style={{
                            borderWidth: 1,
                            borderColor: colors.border,
                            borderRadius: 12,
                            padding: 12,
                            backgroundColor: colors.surface,
                          }}
                        />
                      </View>
                    </View>
                    <View style={{ gap: 6 }}>
                      <Text style={{ fontWeight: '600' }}>Mjerno mjesto</Text>
                      <TextInput
                        value={wizard.measuringPoint}
                        onChangeText={(text) => setWizard((w) => (w ? { ...w, measuringPoint: text } : w))}
                        placeholder="Mjerno mjesto"
                        style={{
                          borderWidth: 1,
                          borderColor: colors.border,
                          borderRadius: 12,
                          padding: 12,
                          backgroundColor: colors.surface,
                        }}
                      />
                    </View>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ flex: 1, gap: 6 }}>
                        <Text style={{ fontWeight: '600' }}>Datum instalacije</Text>
                        <TextInput
                          value={wizard.installationDate}
                          onChangeText={(text) => setWizard((w) => (w ? { ...w, installationDate: text } : w))}
                          placeholder="YYYY-MM-DD"
                          style={{
                            borderWidth: 1,
                            borderColor: colors.border,
                            borderRadius: 12,
                            padding: 12,
                            backgroundColor: colors.surface,
                          }}
                        />
                      </View>
                      <View style={{ flex: 1, gap: 6 }}>
                        <Text style={{ fontWeight: '600' }}>Godina baždarenja</Text>
                        <TextInput
                          value={wizard.calibrationYear}
                          onChangeText={(text) => setWizard((w) => (w ? { ...w, calibrationYear: text } : w))}
                          placeholder="npr. 2026"
                          keyboardType="number-pad"
                          style={{
                            borderWidth: 1,
                            borderColor: colors.border,
                            borderRadius: 12,
                            padding: 12,
                            backgroundColor: colors.surface,
                          }}
                        />
                      </View>
                    </View>
                  </View>
                ) : (
                  <View style={{ gap: 6 }}>
                    <Text style={{ fontWeight: '600' }}>Godina baždarenja (po potrebi)</Text>
                    <TextInput
                      value={wizard.calibrationYear}
                      onChangeText={(text) => setWizard((w) => (w ? { ...w, calibrationYear: text } : w))}
                      placeholder="npr. 2026"
                      keyboardType="number-pad"
                      style={{
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 12,
                        padding: 12,
                        backgroundColor: colors.surface,
                      }}
                    />
                  </View>
                )}
                {wizardFields.length ? (
                  <View style={{ gap: 10 }}>
                    <Text style={{ fontWeight: '600' }}>Dodatna polja (po tipu brojila)</Text>
                    {wizardFields
                      .filter((f) => f.isOperatorFillable)
                      .map((field) => {
                        const rawValue = wizard.dynamicFieldValues[field.name]
                        const valueText =
                          rawValue === undefined || rawValue === null ? '' : String(rawValue)
                        if (field.fieldType === 'BOOLEAN') {
                          const isOn = rawValue === true || rawValue === 'true' || rawValue === 1 || rawValue === '1'
                          return (
                            <Pressable
                              key={field.id}
                              onPress={() => handleDynamicFieldChange(field.name, !isOn)}
                              style={({ pressed }) => ({
                                borderWidth: 1,
                                borderColor: isOn ? colors.primary : colors.border,
                                backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
                                padding: 12,
                                borderRadius: 12,
                              })}
                            >
                              <Text style={{ fontWeight: '700' }}>{field.label}</Text>
                              <Text style={{ color: colors.textMuted, marginTop: 2 }}>
                                {isOn ? 'Da' : 'Ne'}
                              </Text>
                            </Pressable>
                          )
                        }
                        return (
                          <View key={field.id} style={{ gap: 6 }}>
                            <Text style={{ fontWeight: '700' }}>{field.label}</Text>
                            <TextInput
                              value={valueText}
                              onChangeText={(text) => handleDynamicFieldChange(field.name, text)}
                              placeholder={field.isRequired ? 'Obavezno' : 'Opcionalno'}
                              keyboardType={field.fieldType === 'NUMBER' ? 'decimal-pad' : 'default'}
                              style={{
                                borderWidth: 1,
                                borderColor: colors.border,
                                borderRadius: 12,
                                padding: 12,
                                backgroundColor: colors.surface,
                              }}
                            />
                          </View>
                        )
                      })}
                  </View>
                ) : null}
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
                      borderRadius: 12,
                      padding: 12,
                      minHeight: 80,
                      textAlignVertical: 'top',
                      backgroundColor: colors.surface,
                    }}
                  />
                </View>
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
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Potvrdi ugradnju</Text>
                  )}
                </Pressable>
                </ScrollView>
              ) : null}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  )
}

