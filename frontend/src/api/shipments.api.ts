import { axiosInstance } from './axios.instance';
import type { ApiEnvelope } from '@/types/common.types';
import { normalizePreviewRow } from '@/types/import.types';
import type {
    CreateShipmentInput,
  ShipmentItem,
  ShipmentListParams,
  ShipmentSimCardsResponse,
  ShipmentsResponse,
} from '@/types/shipment.types';

import type {
  BackendShipmentImportPreview,
  ImportColumnMapping,
  ShipmentImportApply,
  ShipmentImportPreview,
} from '@/types/import.types';

export const shipmentsApi = {
  list: async (params?: ShipmentListParams): Promise<ShipmentsResponse> => {
    const response = await axiosInstance.get<ApiEnvelope<ShipmentsResponse>>('/shipments', {
      params,
    });
    return response.data.data;
  },
  getById: async (id: string): Promise<ShipmentItem> => {
    const response = await axiosInstance.get<ApiEnvelope<ShipmentItem>>(`/shipments/${id}`);
    return response.data.data;
  },
  listSimCards: async (id: string, params?: { page?: number; limit?: number }) => {
    const response = await axiosInstance.get<ApiEnvelope<ShipmentSimCardsResponse>>(
      `/shipments/${id}/sim-cards`,
      { params },
    );
    return response.data.data;
  },
  listAllSimCards: async (
    id: string,
    onProgress?: (fetched: number, total: number) => void,
    pageLimit = 100,
  ): Promise<ShipmentSimCardsResponse['items']> => {
    const limit = Math.max(1, Math.min(250, Math.floor(pageLimit)));
    const first = await shipmentsApi.listSimCards(id, { page: 1, limit });
    const all: ShipmentSimCardsResponse['items'] = [];
    const seenIds = new Set<string>();
    for (const item of first.items) {
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        all.push(item);
      }
    }
    onProgress?.(all.length, first.total);
    let page = 2;
    while (all.length < first.total && first.items.length > 0) {
      const next = await shipmentsApi.listSimCards(id, { page, limit });
      if (next.items.length === 0) break;
      let added = 0;
      for (const item of next.items) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          all.push(item);
          added += 1;
        }
      }
      onProgress?.(Math.min(all.length, first.total), first.total);
      if (added === 0) break;
      page += 1;
    }
    return all;
  },
  create: async (payload: CreateShipmentInput): Promise<ShipmentItem> => {
    const response = await axiosInstance.post<ApiEnvelope<ShipmentItem>>('/shipments', payload);
    return response.data.data;
  },
  update: async (
    id: string,
    payload: { name?: string; provider?: string; receivedDate?: string; notes?: string | null; distributionId?: string },
  ): Promise<ShipmentItem> => {
    const response = await axiosInstance.patch<ApiEnvelope<ShipmentItem>>(`/shipments/${id}`, payload);
    return response.data.data;
  },
  remove: async (id: string): Promise<{
    deleted: boolean;
    deletedSimCards: number;
    deletedSimEvents: number;
  }> => {
    const response = await axiosInstance.delete<
      ApiEnvelope<{ deleted: boolean; deletedSimCards: number; deletedSimEvents: number }>
    >(`/shipments/${id}`);
    return response.data.data;
  },
  importExcel: async (params: {
    shipmentId: string;
    file: File;
    columnMapping?: ImportColumnMapping;
    applyImport?: boolean;
    selectedRowNumbers?: number[];      // NOVO
    importAllValid?: boolean;
    onUploadProgress?: (percent: number) => void;
  }): Promise<ShipmentImportPreview | ShipmentImportApply> => {
    const formData = new FormData();
    formData.append('file', params.file);
    formData.append('applyImport', params.applyImport ? 'true' : 'false');
    if (params.columnMapping) formData.append('columnMapping', JSON.stringify(params.columnMapping));
    if (params.importAllValid) {
      formData.append('importAllValid', 'true');
    } else if (params.selectedRowNumbers?.length) {
      formData.append('selectedRowNumbers', JSON.stringify(params.selectedRowNumbers));
    }
    // NAPOMENA: ne postavljati 'Content-Type' ručno za FormData — axios/browser mora sam
    // izračunati "boundary" parametar; ručno postavljen header bez boundary-ja može dovesti do
    // toga da server (busboy/multer) ne parsira multipart tijelo ispravno.
    const response = await axiosInstance.post<ApiEnvelope<BackendShipmentImportPreview | ShipmentImportApply>>(
      `/shipments/${params.shipmentId}/import`,
      formData,
      {
        onUploadProgress: (event) => {
          if (!params.onUploadProgress || !event.total || event.total <= 0) return;
          const pct = Math.min(99, Math.round((event.loaded * 100) / event.total));
          params.onUploadProgress(pct);
        },
      },
    );
    const data = response.data.data;

    // Backend redove (errors[]/warning[] stringovi) prebaciti u strukturirane
    // issues — kompatibilnost sa review tabelom (filteri po kodovima greške).
    if (data.mode === 'preview') {
      return { ...data, previewRows: data.previewRows.map(normalizePreviewRow) };
    }
    return data;
  },
};
