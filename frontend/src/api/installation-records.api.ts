import { axiosInstance } from './axios.instance';
import type { ApiEnvelope } from '@/types/common.types';
import type {
  InstallationRecordItem,
  InstallationRecordsListParams,
  InstallationRecordsResponse,
  RecordStatus,
} from '@/types/installation-record.types';

const baseUrl = '/installation-records';

export type CreateInstallationRecordInput =
  | {
      simCardId: string;
      meterId: string;
      installedById: string;
      notes?: string;
      photos?: unknown;
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
      notes?: string;
      photos?: unknown;
    };

export type InstallationRecordPermissions = {
  canSubmitForApproval: boolean;
  canApproveReject: boolean;
  canActivateSep: boolean;
  isApprovalOperator: boolean;
};

export const installationRecordsApi = {
  list: async (
    params?: InstallationRecordsListParams,
  ): Promise<InstallationRecordsResponse> => {
    const response = await axiosInstance.get<
      ApiEnvelope<InstallationRecordsResponse>
    >(baseUrl, { params });
    return response.data.data;
  },

  listMy: async (
    params?: InstallationRecordsListParams,
  ): Promise<InstallationRecordsResponse> => {
    const response = await axiosInstance.get<
      ApiEnvelope<InstallationRecordsResponse>
    >(`${baseUrl}/my`, { params });
    return response.data.data;
  },

  getById: async (id: string): Promise<InstallationRecordItem> => {
    const response = await axiosInstance.get<
      ApiEnvelope<InstallationRecordItem>
    >(`${baseUrl}/${id}`);
    return response.data.data;
  },

  getPermissions: async (id: string): Promise<InstallationRecordPermissions> => {
    const response = await axiosInstance.get<
      ApiEnvelope<InstallationRecordPermissions>
    >(`${baseUrl}/${id}/permissions`);
    return response.data.data;
  },

  create: async (
    payload: CreateInstallationRecordInput,
  ): Promise<InstallationRecordItem> => {
    const response = await axiosInstance.post<
      ApiEnvelope<InstallationRecordItem>
    >(baseUrl, payload);
    return response.data.data;
  },

  update: async (
    id: string,
    payload: { status?: RecordStatus; notes?: string },
  ): Promise<InstallationRecordItem> => {
    const response = await axiosInstance.patch<
      ApiEnvelope<InstallationRecordItem>
    >(`${baseUrl}/${id}`, payload);
    return response.data.data;
  },

  submitForApproval: async (id: string): Promise<InstallationRecordItem> => {
    const response = await axiosInstance.post<
      ApiEnvelope<InstallationRecordItem>
    >(`${baseUrl}/${id}/submit-for-approval`);
    return response.data.data;
  },

  activateInSep: async (id: string): Promise<InstallationRecordItem> => {
    const response = await axiosInstance.post<
      ApiEnvelope<InstallationRecordItem>
    >(`${baseUrl}/${id}/activate-sep`);
    return response.data.data;
  },

  approve: async (id: string): Promise<InstallationRecordItem> => {
    const response = await axiosInstance.post<
      ApiEnvelope<InstallationRecordItem>
    >(`${baseUrl}/${id}/approve`);
    return response.data.data;
  },

  reject: async (
    id: string,
    rejectionReason: string,
  ): Promise<InstallationRecordItem> => {
    const response = await axiosInstance.post<
      ApiEnvelope<InstallationRecordItem>
    >(`${baseUrl}/${id}/reject`, { rejectionReason });
    return response.data.data;
  },

  send: async (
    id: string,
    payload: { recipientGroupIds?: string[]; manualEmails?: string[] },
  ): Promise<InstallationRecordItem> => {
    const response = await axiosInstance.post<
      ApiEnvelope<InstallationRecordItem>
    >(`${baseUrl}/${id}/send`, payload);
    return response.data.data;
  },

  getPdfBlob: async (id: string): Promise<Blob> => {
    const response = await axiosInstance.get<Blob>(`${baseUrl}/${id}/pdf`, {
      responseType: 'blob',
    });
    return response.data;
  },

  getPhotoBlob: async (path: string): Promise<Blob> => {
    const response = await axiosInstance.get<Blob>('/files/photo', {
      params: { path },
      responseType: 'blob',
    });
    return response.data;
  },
};
