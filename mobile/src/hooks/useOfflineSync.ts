import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/store/auth.store'
import { syncOutbox } from '@/offline/outbox'
import { reconcileOfflineSimInventory } from '@/offline/sim-inventory-reconcile'
import { useConnectivity } from './useConnectivity'

export function useOfflineSync(): { isOnline: boolean } {
  const user = useAuthStore((s) => s.user)
  const { isOnline } = useConnectivity()
  const lastOnlineRef = useRef<boolean | null>(null)
  const isSyncingRef = useRef(false)

  useEffect(() => {
    if (!user) return
    const last = lastOnlineRef.current
    lastOnlineRef.current = isOnline
    const becameOnline = last === false && isOnline === true
    if (!becameOnline) return
    if (isSyncingRef.current) return
    isSyncingRef.current = true
    void (async () => {
      try {
        await syncOutbox(user, { maxItems: 50 })
        await reconcileOfflineSimInventory(user)
      } finally {
        isSyncingRef.current = false
      }
    })()
  }, [isOnline, user])

  return { isOnline }
}

