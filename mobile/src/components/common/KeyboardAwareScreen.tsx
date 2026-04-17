import type { ReactNode } from 'react'
import type { ScrollViewProps, StyleProp, ViewStyle } from 'react-native'
import { useRef } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { colors } from '@/theme/colors'

export function KeyboardAwareScreen({
  children,
  style,
  contentStyle,
  backgroundColor,
  paddingHorizontal = 16,
  scrollProps,
}: {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  contentStyle?: StyleProp<ViewStyle>
  backgroundColor?: string
  paddingHorizontal?: number
  scrollProps?: Omit<ScrollViewProps, 'contentContainerStyle' | 'style' | 'children'>
}) {
  const bg = backgroundColor ?? colors.background
  const scrollRef = useRef<ScrollView | null>(null)

  return (
    <KeyboardAvoidingView
      style={[{ flex: 1, backgroundColor: bg }, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <ScrollView
        ref={(node) => {
          scrollRef.current = node
        }}
        style={{ flex: 1 }}
        contentContainerStyle={[
          {
            paddingHorizontal,
            paddingBottom: 28,
            gap: 12,
          },
          contentStyle,
        ]}
        keyboardShouldPersistTaps="handled"
        {...scrollProps}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

