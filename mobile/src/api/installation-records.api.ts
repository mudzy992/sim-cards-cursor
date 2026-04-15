import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { axiosInstance } from './axios.instance';

export type RecordStatus =
  | 'DRAFT'
  | 'SENT'
  | 'SEND_FAILED'
  | 'SEP_ACTIVATED'
  | 'LEGACY_COMPLETED';

export type InstallationRecordItem = {
  id: string;
  recordNumber: string;
  simCardId?: string;
  meterId?: string;
  installationAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  city?: string | null;
  municipality?: string | null;
  installationDate?: string | null;
  installedById: string;
  status: RecordStatus;
  sentToEmail?: string | null;
  sentAt?: string | null;
  pdfPath?: string | null;
  notes?: string | null;
  photos?: string[] | null;
  meterNumber?: string | null;
  createdAt: string;
  updatedAt?: string;
  meter?: {
    id?: string;
    serialNumber?: string;
    dynamicFieldValues?: Record<string, unknown> | null;
    installationAddress?: string | null;
    installationDate?: string | null;
    city?: string | null;
    municipality?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    meterTypeDefinition?: { name: string } | null;
    meterTypeDefinitionId?: string;
    simCard?: {
      id?: string;
      iccid: string;
      ipAddress?: string;
      status?: string;
    } | null;
  } | null;
  installedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
};

export type InstallationRecordsListResponse = {
  items: InstallationRecordItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type CreateInstallationRecordPayload =
  | {
      simCardId: string;
      meterId: string;
      installedById: string;
      notes?: string;
    }
  | {
      simCardId: string;
      installedById: string;
      meterTypeDefinitionId: string;
      serialNumber: string;
      year?: number;
      installationAddress?: string;
      installationDate?: string;
      city?: string;
      municipality?: string;
      branchId?: string;
      measuringPoint?: string;
      latitude?: number;
      longitude?: number;
      dynamicFieldValues?: Record<string, unknown>;
      notes?: string;
      photos?: string[];
    };

type QueuedInstallationRecord = {
  id: string;
  payload: CreateInstallationRecordPayload;
  createdAt: string;
};

const OFFLINE_RECORDS_KEY = 'sim_tracker_offline_records_v2';

async function loadQueuedInstallationRecords(): Promise<QueuedInstallationRecord[]> {
  const raw = await SecureStore.getItemAsync(OFFLINE_RECORDS_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as QueuedInstallationRecord[];
  } catch {
    return [];
  }
}

async function saveQueuedInstallationRecords(queue: QueuedInstallationRecord[]): Promise<void> {
  if (!queue.length) {
    await SecureStore.deleteItemAsync(OFFLINE_RECORDS_KEY);
    return;
  }
  await SecureStore.setItemAsync(OFFLINE_RECORDS_KEY, JSON.stringify(queue));
}

export async function queueInstallationRecord(payload: CreateInstallationRecordPayload): Promise<void> {
  const existing = await loadQueuedInstallationRecords();
  const queued: QueuedInstallationRecord = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    payload,
    createdAt: new Date().toISOString(),
  };
  await saveQueuedInstallationRecords([...existing, queued]);
}

export async function syncOfflineInstallationRecords(): Promise<void> {
  const queue = await loadQueuedInstallationRecords();
  if (!queue.length) return;

  const remaining: QueuedInstallationRecord[] = [];

  // pokušaj slanja svake queued stavke; ako je mreža nedostupna, prekini rani
  for (const item of queue) {
    try {
      await axiosInstance.post('/installation-records', item.payload);
      // uspješno – ne vraćamo u queue
    } catch (error) {
      if (axios.isAxiosError(error) && !error.response) {
        // backend nedostupan / offline – prekidamo obradu, preostale ostaju u queue
        remaining.push(item, ...queue.slice(queue.indexOf(item) + 1));
        break;
      }

      // server-side greška – preskačemo ovu stavku, da se ne blokira cijeli queue
      // (može se naknadno vidjeti u activity logu / backend logovima)
    }
  }

  await saveQueuedInstallationRecords(remaining);
}

export const installationRecordsApi = {
  listMy: async (params?: {
    page?: number;
    limit?: number;
    status?: RecordStatus;
  }): Promise<InstallationRecordsListResponse> => {
    const response = await axiosInstance.get('/installation-records/my', {
      params,
    });
    return response.data.data;
  },

  getById: async (id: string): Promise<InstallationRecordItem> => {
    const response = await axiosInstance.get(`/installation-records/${id}`);
    return response.data.data;
  },

  create: async (payload: CreateInstallationRecordPayload) => {
    const response = await axiosInstance.post('/installation-records', payload);
    return response.data.data;
  },

  getPermissions: async (
    id: string,
  ): Promise<{ canRetrySend: boolean; canMarkSepActivated: boolean }> => {
    const response = await axiosInstance.get(`/installation-records/${id}/permissions`);
    return response.data.data;
  },

  markSepActivated: async (id: string): Promise<InstallationRecordItem> => {
    const response = await axiosInstance.post(
      `/installation-records/${id}/mark-sep-activated`,
    );
    return response.data.data;
  },

  retrySend: async (id: string): Promise<InstallationRecordItem> => {
    const response = await axiosInstance.post(`/installation-records/${id}/retry-send`);
    return response.data.data;
  },

  uploadPhoto: async (uri: string): Promise<string> => {
    const formData = new FormData();
    formData.append('file', {
      uri,
      type: 'image/jpeg',
      name: 'photo.jpg',
    } as unknown as Blob);
    const response = await axiosInstance.post<{ data: { path: string } }>(
      '/installation-records/upload-photo',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      },
    );
    return response.data.data.path;
  },
};
