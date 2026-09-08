import { Ionicons } from '@expo/vector-icons'
import { Pressable, Text, View } from 'react-native'
import { colors } from '@/theme/colors'

export function OfflineRequiredNotice({
  title = 'Nema mreže',
  message = 'Ovaj ekran zahtijeva internet vezu.',
  onRetry,
}: {
  title?: string
  message?: string
  onRetry?: () => void
}) {
  return (
    <View style={{ flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <Ionicons name="cloud-offline-outline" size={44} color="#64748b" />
      <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a' }}>{title}</Text>
      <Text style={{ color: colors.textMuted, textAlign: 'center' }}>{message}</Text>
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          style={({ pressed }) => ({
            marginTop: 4,
            backgroundColor: pressed ? colors.primaryPressed : colors.primary,
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderRadius: 12,
          })}
        >
          <Text style={{ color: '#fff', fontWeight: '800' }}>Pokušaj ponovo</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

