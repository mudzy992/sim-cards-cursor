export type ShipmentStatus = 'RECEIVED' | 'PROCESSING' | 'COMPLETED';

export type SimCardStatus =
  | 'AVAILABLE'
  | 'ASSIGNED'
  | 'INSTALLED'
  | 'DEMOUNTED'
  | 'DEFECTIVE'
  | 'RETURNED'
  | 'DEACTIVATED';

export type SimCardAssignee = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
} | null;

export type ShipmentSimCard = {
  id: string;
  iccid: string;
  ipAddress: string;
  publicIpAddress: string | null;
  status: SimCardStatus;
  phoneNumber: string | null;
  apn: string | null;
  shipmentId: string;
  assignedTo: SimCardAssignee;
  assignedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ShipmentItem = {
  id: string;
  name: string;
  provider: string;
  receivedDate: string;
  totalCards: number;
  status: ShipmentStatus;
  notes?: string | null;
  originalFileName?: string | null;
  distributionId?: string | null;
  importedBy: { id: string; email: string; firstName: string; lastName: string };
  _count: { simCards: number };
  createdAt: string;
  updatedAt: string;
};

export type ShipmentListParams = {
  page?: number;
  limit?: number;
  search?: string;
  provider?: string;
  status?: ShipmentStatus;
};

export type ShipmentsResponse = {
  items: ShipmentItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type CreateShipmentInput = {
  name: string;
  provider: string;
  receivedDate: string;
  /** Pri kreiranju se ne šalje; postavlja se pri Excel importu na broj uvezenih kartica */
  totalCards?: number;
  notes?: string;
  distributionId: string;
};

export type ShipmentSimCardsResponse = {
  items: ShipmentSimCard[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type {
  ImportColumnMapping,
  ImportPreviewRow,
  ImportSummary,
  ShipmentImportPreview,
  ShipmentImportApply,
} from './import.types';
