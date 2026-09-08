import axios from 'axios';
import { axiosInstance } from './axios.instance';
import { useAuthStore } from '@/store/auth.store'
import { offlineCache } from '@/offline/offline-cache'
import { enqueueOutboxItem } from '@/offline/outbox'

export type MobileSimCard = {
  id: string;
  iccid: string;
  ipAddress: string;
  publicIpAddress?: string | null;
  status: string;
  phoneNumber?: string | null;
  assignedTo?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  shipment?: {
    id: string;
    name: string;
    provider?: string;
  } | null;
  fromOfflineCache?: boolean;
};

function requireUser() {
  const user = useAuthStore.getState().user
  if (!user) throw new Error('Not authenticated')
  return user
}

export const simCardsApi = {
  scanByIccid: async (iccid: string): Promise<MobileSimCard> => {
    const response = await axiosInstance.get(`/sim-cards/scan/${iccid}`);
    return response.data.data;
  },

  scanByIccidWithOffline: async (iccid: string): Promise<MobileSimCard> => {
    const user = requireUser()
    try {
      const online = await simCardsApi.scanByIccid(iccid);
      await offlineCache.offlineSimInventory.upsert(user, online)
      return { ...online, fromOfflineCache: false };
    } catch (error) {
      if (axios.isAxiosError(error) && !error.response) {
        const cached = await offlineCache.offlineSimInventory.findByIccid(user, iccid)
        if (cached) {
          return cached;
        }
      }
      throw error;
    }
  },

  listOfflineInventory: async (): Promise<MobileSimCard[]> => {
    const user = requireUser()
    return (await offlineCache.offlineSimInventory.get(user))?.data ?? []
  },

  removeOfflineInventoryByIccid: async (iccid: string): Promise<void> => {
    const user = requireUser()
    await offlineCache.offlineSimInventory.removeByIccid(user, iccid)
  },

  clearOfflineInventory: async (): Promise<void> => {
    const user = requireUser()
    await offlineCache.offlineSimInventory.clear(user)
  },

  claimById: async (id: string): Promise<MobileSimCard> => {
    const user = requireUser()
    try {
      const response = await axiosInstance.post(`/sim-cards/${id}/claim`)
      const claimed = response.data.data as MobileSimCard
      await offlineCache.offlineSimInventory.upsert(user, claimed)
      return claimed
    } catch (error) {
      if (axios.isAxiosError(error) && !error.response) {
        await enqueueOutboxItem(user, {
          kind: 'SIM_CARD_CLAIM',
          request: { method: 'POST', url: `/sim-cards/${id}/claim`, body: {} },
          meta: { simCardId: id },
        })

        const existing = (await offlineCache.offlineSimInventory.get(user))?.data ?? []
        const next = existing.map((c) => {
          if (c.id !== id) return c
          return {
            ...c,
            status: 'ASSIGNED',
            assignedTo: {
              id: user.id,
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
            },
            fromOfflineCache: true,
          }
        })
        await offlineCache.offlineSimInventory.set(user, next)

        const updated = next.find((c) => c.id === id)
        if (updated) return updated

        return {
          id,
          iccid: '',
          ipAddress: '',
          status: 'ASSIGNED',
          assignedTo: {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
          },
          fromOfflineCache: true,
        }
      }
      throw error
    }
  },

  myAssigned: async (): Promise<MobileSimCard[]> => {
    const user = requireUser()
    try {
      const response = await axiosInstance.get('/sim-cards/my-assigned')
      const data = response.data.data
      const list = Array.isArray(data) ? (data as MobileSimCard[]) : []
      await offlineCache.myAssignedSimCards.set(user, list)
      return list
    } catch (error) {
      if (axios.isAxiosError(error) && !error.response) {
        return (await offlineCache.myAssignedSimCards.get(user))?.data ?? []
      }
      throw error
    }
  },
};
