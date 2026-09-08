import type { ReactNode } from 'react'
import type { ScrollViewProps, StyleProp, ViewStyle } from 'react-native'
import { ScrollView, View } from 'react-native'
import { colors } from '@/theme/colors'

type ScreenBaseProps = {
  children: ReactNode
  backgroundColor?: string
  style?: StyleProp<ViewStyle>
  contentStyle?: StyleProp<ViewStyle>
  paddingHorizontal?: number
}

type ScreenScrollProps = ScreenBaseProps & {
  scroll: true
  scrollProps?: Omit<ScrollViewProps, 'contentContainerStyle' | 'style' | 'children'>
}

type ScreenStaticProps = ScreenBaseProps & {
  scroll?: false
}

export function Screen(props: ScreenScrollProps | ScreenStaticProps) {
  const paddingHorizontal = props.paddingHorizontal ?? 16
  const backgroundColor = props.backgroundColor ?? colors.background

  if ('scroll' in props && props.scroll) {
    return (
      <ScrollView
        style={[{ flex: 1, backgroundColor }, props.style]}
        contentContainerStyle={[
          {
            paddingHorizontal,
            paddingBottom: 20,
            gap: 12,
          },
          props.contentStyle,
        ]}
        keyboardShouldPersistTaps="handled"
        {...props.scrollProps}
      >
        {props.children}
      </ScrollView>
    )
  }

  return (
    <View style={[{ flex: 1, backgroundColor, paddingHorizontal, paddingBottom: 20 }, props.style]}>
      {props.children}
    </View>
  )
}

