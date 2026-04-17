import axios from 'axios'
import type { AuthUser } from '@/types/auth.types'
import { simCardsApi } from '@/api/sim-cards.api'
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
  const removedIccids: string[] = []
  const updatedByIccid = new Map<string, unknown>()

  for (const entry of slice) {
    const iccid = entry.iccid?.trim()
    if (!iccid) continue
    try {
      const fresh = await simCardsApi.scanByIccid(iccid)
      const status = String((fresh as { status?: unknown }).status ?? '')
      const assignedToId = (fresh as { assignedTo?: { id?: string } | null }).assignedTo?.id

      const shouldRemove =
        status !== 'AVAILABLE' && !(status === 'ASSIGNED' && assignedToId === user.id)

      if (shouldRemove) {
        removedIccids.push(iccid)
        continue
      }

      updatedByIccid.set(iccid, fresh)
    } catch (error) {
      if (axios.isAxiosError(error) && !error.response) {
        break
      }
    }
  }

  if (removedIccids.length === 0 && updatedByIccid.size === 0) {
    return { removedIccids: [], kept: cached.length, updated: 0 }
  }

  const next = cached
    .filter((c) => !removedIccids.includes(c.iccid))
    .map((c) => {
      const fresh = updatedByIccid.get(c.iccid) as any
      if (!fresh) return c
      return { ...fresh, fromOfflineCache: undefined }
    })

  await offlineCache.offlineSimInventory.set(user, next as any)
  return {
    removedIccids,
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

