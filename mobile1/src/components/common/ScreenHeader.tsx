import type { ReactNode } from 'react'
import { Platform, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '@/theme/colors'
import { useConnectivity } from '@/hooks/useConnectivity'

export function ScreenHeader({
  title,
  subtitle,
  right,
}: {
  title: string
  subtitle?: string
  right?: ReactNode
}) {
  const insets = useSafeAreaInsets()
  const { isOnline } = useConnectivity()
  const topPadding =
    Platform.OS === 'ios'
      ? Math.max(insets.top, 10)
      : isOnline
        ? 10
        : 10

  return (
    <View
      style={{
        paddingTop: topPadding,
        paddingHorizontal: 16,
        paddingBottom: 12,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        elevation: 2,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>{title}</Text>
          {subtitle ? (
            <Text style={{ marginTop: 4, fontSize: 13, color: colors.textMuted }}>{subtitle}</Text>
          ) : null}
        </View>
        {right ? <View>{right}</View> : null}
      </View>
    </View>
  )
}
