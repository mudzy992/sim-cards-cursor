import axios from 'axios';
import { axiosInstance } from './axios.instance';
import { useAuthStore } from '@/store/auth.store'
import { enqueueOutboxItem, syncOutbox } from '@/offline/outbox'
import { installationRecordsUploadApi } from './installation-records-upload.api'

export type RecordStatus =
  | 'DRAFT'
  | 'SENT'
  | 'SEND_FAILED'
  | 'SEP_ACTIVATED'
  | 'LEGACY_COMPLETED';

export type InstallationRecordKind = 'NEW_CONNECTION' | 'METER_REPLACEMENT';

export type InstallationRecordItem = {
  id: string;
  recordNumber: string;
  kind?: InstallationRecordKind;
  demountedMeterSnapshot?: Record<string, unknown> | null;
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

export type DemountedMeterPayload = {
  meterTypeDefinitionId: string;
  serialNumber: string;
  year: number;
  calibrationYear: number;
  dynamicFieldValues?: Record<string, unknown>;
  notes?: string;
  hadIntegratedSim?: boolean;
  noSimNote?: string;
};

export type CreateInstallationRecordPayload =
  | {
      simCardId: string;
      meterId: string;
      installedById: string;
      notes?: string;
      clientRequestId?: string;
    }
  | {
      simCardId: string;
      installedById: string;
      kind?: InstallationRecordKind;
      demountedMeter?: DemountedMeterPayload;
      meterTypeDefinitionId: string;
      serialNumber: string;
      year: number;
      calibrationYear: number;
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
      clientRequestId?: string;
    };

function requireUser() {
  const user = useAuthStore.getState().user
  if (!user) throw new Error('Not authenticated')
  return user
}

export async function queueInstallationRecord(payload: CreateInstallationRecordPayload): Promise<void> {
  const user = requireUser()
  const localPhotoUris = (payload as any)?.localPhotoUris as unknown
  const sanitizedPayload =
    localPhotoUris && typeof localPhotoUris === 'object'
      ? (() => {
          const { localPhotoUris: _ignored, ...rest } = payload as any
          return rest as CreateInstallationRecordPayload
        })()
      : payload
  await enqueueOutboxItem(user, {
    kind: 'INSTALLATION_RECORD_CREATE',
    request: { method: 'POST', url: '/installation-records', body: sanitizedPayload },
    meta: {
      simCardId: payload.simCardId,
      meterId: 'meterId' in payload ? payload.meterId : undefined,
      localPhotoUris: Array.isArray(localPhotoUris) ? (localPhotoUris as string[]) : undefined,
    },
  })
}

export async function syncOfflineInstallationRecords(): Promise<void> {
  const user = useAuthStore.getState().user
  if (!user) return
  await syncOutbox(user, { maxItems: 50 })
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

  uploadPhoto: installationRecordsUploadApi.uploadPhoto,
};
