import { Image, StyleSheet, View } from 'react-native'

type LogoWatermarkProps = {
  opacity?: number
}

export function LogoWatermark({ opacity = 0.1 }: LogoWatermarkProps) {
  return (
    <View pointerEvents="none" style={styles.root}>
      <Image
        source={require('../../assets/Logo.png')}
        style={[styles.image, { opacity }]}
        resizeMode="contain"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    right: -70,
    top: '48%',
    transform: [{ translateY: -160 }, { rotate: '-12deg' }],
  },
  image: {
    width: 320,
    height: 320,
  },
})

