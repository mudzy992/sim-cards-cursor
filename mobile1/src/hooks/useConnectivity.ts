import NetInfo from '@react-native-community/netinfo'
import { useEffect, useState } from 'react'

export type ConnectivityState = {
  isOnline: boolean
  isInternetReachable: boolean | null
}

export function useConnectivity(): ConnectivityState {
  const [state, setState] = useState<ConnectivityState>({
    isOnline: true,
    isInternetReachable: null,
  })

  useEffect(() => {
    const unsub = NetInfo.addEventListener((s) => {
      setState({
        isOnline: Boolean(s.isConnected),
        isInternetReachable: s.isInternetReachable ?? null,
      })
    })
    return () => {
      unsub()
    }
  }, [])

  return state
}

