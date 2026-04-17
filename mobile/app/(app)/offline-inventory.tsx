import axios from 'axios'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { simCardsApi, type MobileSimCard } from '@/api/sim-cards.api'
import { useAuthStore } from '@/store/auth.store'
import { reconcileOfflineSimInventory } from '@/offline/sim-inventory-reconcile'
import { useConnectivity } from '@/hooks/useConnectivity'
import { colors } from '@/theme/colors'

export default function OfflineInventoryScreen() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const { isOnline } = useConnectivity()
  const params = useLocalSearchParams<{ pickedIccid?: string }>()
  const pickedIccid =
    typeof params.pickedIccid === 'string' ? params.pickedIccid : params.pickedIccid?.[0]

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [items, setItems] = useState<MobileSimCard[]>([])
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true)
    else setIsLoading(true)
    setError(null)
    try {
      if (refresh && user && isOnline) {
        await reconcileOfflineSimInventory(user)
      }
      const list = await simCardsApi.listOfflineInventory()
      setItems(list)
    } catch {
      setError('Nije moguće učitati offline inventar.')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [user, isOnline])

  useEffect(() => {
    void load(false)
  }, [load])

  useEffect(() => {
    const iccid = pickedIccid?.trim()
    if (!iccid) return
    let cancelled = false
    void (async () => {
      try {
        await simCardsApi.scanByIccidWithOffline(iccid)
      } catch (e) {
        if (cancelled) return
        if (axios.isAxiosError(e) && !e.response) {
          Alert.alert('Offline', 'SIM nije dostupna online i nije nađena u lokalnom inventaru.')
        } else {
          Alert.alert('Greška', 'Nije moguće dodati SIM u offline inventar.')
        }
      } finally {
        if (!cancelled) {
          router.replace('/(app)/offline-inventory' as const)
          void load(true)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [pickedIccid, router, load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((c) => c.iccid.toLowerCase().includes(q) || (c.ipAddress ?? '').includes(q))
  }, [items, query])

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={{ fontSize: 20, fontWeight: '700' }}>Offline inventar</Text>
          <Text style={{ color: colors.textMuted, marginTop: 2 }}>
            Skeniraj SIM kartice prije terena. Wizard-i koriste ovaj inventar kada nema mreže.
          </Text>
        </View>
        <Pressable
          onPress={() =>
            router.push({ pathname: '/(app)/(tabs)/scan', params: { afterScan: 'inventory' } })
          }
          accessibilityLabel="Skeniraj SIM za offline inventar"
          style={({ pressed }) => ({
            backgroundColor: pressed ? colors.primaryPressed : colors.primary,
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderRadius: 12,
          })}
        >
          <Ionicons name="scan" size={22} color="#fff" />
        </Pressable>
      </View>

      {error ? <Text style={{ color: '#dc2626' }}>{error}</Text> : null}

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Pretraga ICCID ili IP"
        autoCapitalize="none"
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          padding: 12,
        }}
      />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.iccid}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void load(true)} />}
        ListEmptyComponent={
          <Text style={{ color: colors.textMuted, marginTop: 24, textAlign: 'center' }}>
            Offline inventar je prazan. Skeniraj SIM kartice koje nosiš na teren.
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            onLongPress={() => {
              Alert.alert('Ukloni', `Ukloniti ${item.iccid} iz offline inventara?`, [
                { text: 'Odustani', style: 'cancel' },
                {
                  text: 'Ukloni',
                  style: 'destructive',
                  onPress: () =>
                    void (async () => {
                      await simCardsApi.removeOfflineInventoryByIccid(item.iccid)
                      void load(true)
                    })(),
                },
              ])
            }}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              padding: 12,
              marginBottom: 8,
              backgroundColor: colors.surface,
            }}
          >
            <Text style={{ fontWeight: '700' }}>{item.iccid}</Text>
            <Text style={{ color: colors.textMuted, marginTop: 2 }}>IP: {item.ipAddress ?? '–'}</Text>
            <Text style={{ color: colors.textMuted, marginTop: 2 }}>
              Status: {item.status ?? '–'}
            </Text>
          </Pressable>
        )}
      />

      <Pressable
        onPress={() => {
          Alert.alert('Obriši sve', 'Obrisati kompletan offline inventar?', [
            { text: 'Odustani', style: 'cancel' },
            {
              text: 'Obriši',
              style: 'destructive',
              onPress: () =>
                void (async () => {
                  await simCardsApi.clearOfflineInventory()
                  void load(true)
                })(),
            },
          ])
        }}
        style={{
          borderWidth: 1,
          borderColor: '#fecaca',
          backgroundColor: '#fff',
          borderRadius: 12,
          padding: 12,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#b91c1c', fontWeight: '700' }}>Obriši inventar</Text>
      </Pressable>
    </View>
  )
}

