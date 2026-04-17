import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '@/store/auth.store'
import { clearOutbox, listOutbox, syncOutbox, type OutboxItem } from '@/offline/outbox'
import { colors } from '@/theme/colors'

const kindLabel: Record<string, string> = {
  INSTALLATION_RECORD_CREATE: 'Kreiranje zapisnika',
  DEMOUNT_TASK_UPDATE_STATUS: 'Demontaža: status',
  DEMOUNT_TASK_COMPLETE: 'Demontaža: završetak',
  INSTALL_TASK_UPDATE_STATUS: 'Ugradnja: status',
  INSTALL_TASK_COMPLETE: 'Ugradnja: završetak',
}

function statusTone(status: OutboxItem['status']): { bg: string; fg: string; text: string } {
  if (status === 'PENDING') return { bg: '#fef3c7', fg: '#92400e', text: 'Na čekanju' }
  if (status === 'SENDING') return { bg: '#e0f2fe', fg: '#075985', text: 'Šaljem' }
  if (status === 'FAILED') return { bg: '#fee2e2', fg: '#991b1b', text: 'Greška' }
  return { bg: '#dcfce7', fg: '#166534', text: 'Poslano' }
}

export default function OutboxScreen() {
  const user = useAuthStore((s) => s.user)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [items, setItems] = useState<OutboxItem[]>([])
  const [syncing, setSyncing] = useState(false)

  const load = useCallback(async (refresh = false) => {
    if (!user) return
    if (refresh) setIsRefreshing(true)
    else setIsLoading(true)
    try {
      const list = await listOutbox(user)
      setItems(list)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [user])

  useEffect(() => {
    void load(false)
  }, [load])

  const counts = useMemo(() => {
    const pending = items.filter((i) => i.status === 'PENDING' || i.status === 'SENDING').length
    const failed = items.filter((i) => i.status === 'FAILED').length
    return { pending, failed, total: items.length }
  }, [items])

  if (!user) {
    return (
      <View style={{ flex: 1, padding: 16, justifyContent: 'center' }}>
        <Text style={{ color: '#dc2626' }}>Niste prijavljeni.</Text>
      </View>
    )
  }

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
          <Text style={{ fontSize: 20, fontWeight: '700' }}>Neposlato</Text>
          <Text style={{ color: colors.textMuted, marginTop: 2 }}>
            Offline akcije čekaju slanje. Na reconnect se šalju automatski, ili ručno “Pošalji sada”.
          </Text>
        </View>
        <Pressable
          disabled={syncing}
          onPress={() =>
            void (async () => {
              setSyncing(true)
              try {
                await syncOutbox(user, { maxItems: 50 })
              } finally {
                setSyncing(false)
                void load(true)
              }
            })()
          }
          accessibilityLabel="Pošalji sada"
          style={({ pressed }) => ({
            backgroundColor: pressed ? colors.primaryPressed : colors.primary,
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderRadius: 12,
            opacity: syncing ? 0.7 : 1,
          })}
        >
          {syncing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Ionicons name="cloud-upload-outline" size={22} color="#fff" />
          )}
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <View style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 }}>
          <Text style={{ color: '#475569', fontWeight: '600', fontSize: 12 }}>
            Ukupno: {counts.total}
          </Text>
        </View>
        <View style={{ backgroundColor: '#fef3c7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 }}>
          <Text style={{ color: '#92400e', fontWeight: '600', fontSize: 12 }}>
            Na čekanju: {counts.pending}
          </Text>
        </View>
        <View style={{ backgroundColor: '#fee2e2', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 }}>
          <Text style={{ color: '#991b1b', fontWeight: '600', fontSize: 12 }}>
            Greške: {counts.failed}
          </Text>
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void load(true)} />}
        ListEmptyComponent={
          <Text style={{ color: colors.textMuted, marginTop: 24, textAlign: 'center' }}>
            Nema neposlatih stavki.
          </Text>
        }
        renderItem={({ item }) => {
          const badge = statusTone(item.status)
          return (
            <View
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                padding: 12,
                marginBottom: 8,
                backgroundColor: colors.surface,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700' }}>{kindLabel[item.kind] ?? item.kind}</Text>
                  <Text style={{ color: colors.textMuted, marginTop: 2, fontSize: 12 }}>
                    {new Date(item.createdAt).toLocaleString()}
                  </Text>
                </View>
                <View style={{ backgroundColor: badge.bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' }}>
                  <Text style={{ color: badge.fg, fontWeight: '700', fontSize: 12 }}>{badge.text}</Text>
                </View>
              </View>

              {item.meta?.taskId ? (
                <Text style={{ color: colors.textMuted, marginTop: 6, fontSize: 12 }}>
                  Task: {item.meta.taskId}
                </Text>
              ) : null}

              {item.lastError ? (
                <Text style={{ color: '#991b1b', marginTop: 8, fontSize: 12 }}>
                  {item.lastError}
                </Text>
              ) : null}
            </View>
          )
        }}
      />

      {items.length > 0 ? (
        <Pressable
          onPress={() => {
            Alert.alert('Obriši neposlato', 'Obrisati sve stavke iz liste “Neposlato”?', [
              { text: 'Odustani', style: 'cancel' },
              {
                text: 'Obriši',
                style: 'destructive',
                onPress: () =>
                  void (async () => {
                    await clearOutbox(user)
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
          <Text style={{ color: '#b91c1c', fontWeight: '700' }}>Obriši sve</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

