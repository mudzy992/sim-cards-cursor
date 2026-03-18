import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { axiosInstance } from './axios.instance';

export type MobileSimCard = {
  id: string;
  iccid: string;
  ipAddress: string;
  publicIpAddress?: string | null;
  status: string;
  phoneNumber?: string | null;
  apn?: string | null;
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

type OfflineSimCardEntry = {
  iccid: string;
  data: MobileSimCard;
  cachedAt: string;
};

const OFFLINE_SIM_CARDS_KEY = 'sim_tracker_offline_sim_cards_v1';

async function loadOfflineSimCards(): Promise<OfflineSimCardEntry[]> {
  const raw = await SecureStore.getItemAsync(OFFLINE_SIM_CARDS_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as OfflineSimCardEntry[];
  } catch {
    return [];
  }
}

async function saveOfflineSimCards(entries: OfflineSimCardEntry[]): Promise<void> {
  if (!entries.length) {
    await SecureStore.deleteItemAsync(OFFLINE_SIM_CARDS_KEY);
    return;
  }
  await SecureStore.setItemAsync(OFFLINE_SIM_CARDS_KEY, JSON.stringify(entries));
}

async function upsertOfflineSimCard(card: MobileSimCard): Promise<void> {
  if (!card.iccid) return;
  const existing = await loadOfflineSimCards();
  const now = new Date().toISOString();
  const filtered = existing.filter((e) => e.iccid !== card.iccid);
  filtered.push({
    iccid: card.iccid,
    data: { ...card, fromOfflineCache: undefined },
    cachedAt: now,
  });
  await saveOfflineSimCards(filtered);
}

async function getOfflineSimCardByIccid(iccid: string): Promise<MobileSimCard | null> {
  const existing = await loadOfflineSimCards();
  const found = existing.find((e) => e.iccid === iccid);
  return found ? { ...found.data, fromOfflineCache: true } : null;
}

export const simCardsApi = {
  scanByIccid: async (iccid: string): Promise<MobileSimCard> => {
    const response = await axiosInstance.get(`/sim-cards/scan/${iccid}`);
    return response.data.data;
  },

  scanByIccidWithOffline: async (iccid: string): Promise<MobileSimCard> => {
    try {
      const online = await simCardsApi.scanByIccid(iccid);
      await upsertOfflineSimCard(online);
      return { ...online, fromOfflineCache: false };
    } catch (error) {
      if (axios.isAxiosError(error) && !error.response) {
        const cached = await getOfflineSimCardByIccid(iccid);
        if (cached) {
          return cached;
        }
      }
      throw error;
    }
  },

  claimById: async (id: string): Promise<MobileSimCard> => {
    const response = await axiosInstance.post(`/sim-cards/${id}/claim`);
    return response.data.data;
  },
  myAssigned: async () => {
    const response = await axiosInstance.get('/sim-cards/my-assigned');
    return response.data.data;
  },
};
