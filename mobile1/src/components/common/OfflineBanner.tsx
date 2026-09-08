import { Ionicons } from '@expo/vector-icons'
import type { LayoutChangeEvent } from 'react-native'
import { Platform, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useConnectivity } from '@/hooks/useConnectivity'
import { colors } from '@/theme/colors'

export function OfflineBanner({ onHeight }: { onHeight?: (height: number) => void }) {
  const { isOnline } = useConnectivity()
  const insets = useSafeAreaInsets()
  if (isOnline) return null
  const contentTopPadding =
    Platform.OS === 'ios' ? Math.max(insets.top, 10) : Math.max(insets.top, 0) + 6

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        backgroundColor: colors.warningSurface,
        borderBottomWidth: 1,
        borderBottomColor: colors.warningBorder,
        paddingHorizontal: 12,
        paddingTop: contentTopPadding,
        paddingBottom: 3,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
      }}
      onLayout={(e: LayoutChangeEvent) => onHeight?.(e.nativeEvent.layout.height)}
    >
      <Ionicons name="cloud-offline-outline" size={18} color="#92400e" />
      <Text style={{ color: '#92400e', fontWeight: '800', fontSize: 13 }}>
        Offline režim — promjene će se poslati kada se mreža vrati
      </Text>
    </View>
  )
}
