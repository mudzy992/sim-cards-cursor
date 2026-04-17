import { Ionicons } from '@expo/vector-icons'
import { Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useConnectivity } from '@/hooks/useConnectivity'

export function OfflineBanner() {
  const { isOnline } = useConnectivity()
  const insets = useSafeAreaInsets()
  if (isOnline) return null

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        backgroundColor: '#fef3c7',
        borderBottomWidth: 1,
        borderBottomColor: '#f59e0b',
        paddingHorizontal: 12,
        paddingTop: Math.max(insets.top, 10),
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <Ionicons name="cloud-offline-outline" size={18} color="#92400e" />
      <Text style={{ color: '#92400e', fontWeight: '700', fontSize: 13 }}>
        Offline režim — promjene će se poslati kada se mreža vrati
      </Text>
    </View>
  )
}
