import { axiosInstance } from './axios.instance';
import type { ApiEnvelope } from '@/types/common.types';
import type {
  CreateShipmentInput,
  ImportColumnMapping,
  ShipmentImportApply,
  ShipmentImportPreview,
  ShipmentItem,
  ShipmentListParams,
  ShipmentSimCardsResponse,
  ShipmentsResponse,
} from '@/types/shipment.types';

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
  ): Promise<ShipmentSimCardsResponse['items']> => {
    const limit = 100;
    const first = await shipmentsApi.listSimCards(id, { page: 1, limit });
    const all = [...first.items];
    onProgress?.(all.length, first.total);
    while (all.length < first.total) {
      const nextPage = Math.floor(all.length / limit) + 1;
      const next = await shipmentsApi.listSimCards(id, { page: nextPage, limit });
      all.push(...next.items);
      onProgress?.(Math.min(all.length, first.total), first.total);
    }
    return all;
  },
  create: async (payload: CreateShipmentInput): Promise<ShipmentItem> => {
    const response = await axiosInstance.post<ApiEnvelope<ShipmentItem>>('/shipments', payload);
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
  }): Promise<ShipmentImportPreview | ShipmentImportApply> => {
    const formData = new FormData();
    formData.append('file', params.file);
    formData.append('applyImport', params.applyImport ? 'true' : 'false');
    if (params.columnMapping) {
      formData.append('columnMapping', JSON.stringify(params.columnMapping));
    }

    const response = await axiosInstance.post<
      ApiEnvelope<ShipmentImportPreview | ShipmentImportApply>
    >(`/shipments/${params.shipmentId}/import`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data;
  },
};
