import axios from 'axios'
import { normalizeIccid } from '@sim-tracker/shared'
import type { AuthUser } from '@/types/auth.types'
import { simCardsApi, type MobileSimCard } from '@/api/sim-cards.api'
import { offlineCache } from './offline-cache'

type ReconcileResult = {
  removedIccids: string[]
  kept: number
  updated: number
}

const MAX_ITEMS = 80

export async function reconcileOfflineSimInventory(user: AuthUser): Promise<ReconcileResult> {
  const cached = (await offlineCache.offlineSimInventory.get(user))?.data ?? []
  if (cached.length === 0) {
    return { removedIccids: [], kept: 0, updated: 0 }
  }

  const slice = cached.slice(0, MAX_ITEMS)
  const removedIccids = new Set<string>()
  const updatedByIccid = new Map<string, MobileSimCard>()

  for (const entry of slice) {
    const iccid = normalizeIccid(entry.iccid ?? '')
    if (!iccid) continue
    try {
      const fresh = await simCardsApi.scanByIccid(iccid)
      const status = String(fresh.status ?? '')
      const assignedToId = fresh.assignedTo?.id

      const shouldRemove =
        status !== 'AVAILABLE' && !(status === 'ASSIGNED' && assignedToId === user.id)

      if (shouldRemove) {
        removedIccids.add(iccid)
        continue
      }

      updatedByIccid.set(iccid, fresh)
    } catch (error) {
      if (axios.isAxiosError(error) && !error.response) {
        break
      }
    }
  }

  if (removedIccids.size === 0 && updatedByIccid.size === 0) {
    return { removedIccids: [], kept: cached.length, updated: 0 }
  }

  const next: MobileSimCard[] = cached
    .filter((c) => !removedIccids.has(normalizeIccid(c.iccid)))
    .map((c) => {
      const fresh = updatedByIccid.get(normalizeIccid(c.iccid))
      if (!fresh) return c
      return { ...fresh, fromOfflineCache: undefined }
    })

  await offlineCache.offlineSimInventory.set(user, next)
  return {
    removedIccids: Array.from(removedIccids),
    kept: next.length,
    updated: updatedByIccid.size,
  }
}

export async function removeSimFromOfflineInventoryById(
  user: AuthUser,
  simCardId: string,
): Promise<void> {
  const cached = (await offlineCache.offlineSimInventory.get(user))?.data ?? []
  const next = cached.filter((c) => c.id !== simCardId)
  await offlineCache.offlineSimInventory.set(user, next)
}

