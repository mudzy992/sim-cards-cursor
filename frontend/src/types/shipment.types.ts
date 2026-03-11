export type ShipmentStatus = 'RECEIVED' | 'PROCESSING' | 'COMPLETED';

export type ShipmentListParams = {
  page?: number;
  limit?: number;
  search?: string;
  provider?: string;
  status?: ShipmentStatus;
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
  importedBy: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  _count: {
    simCards: number;
  };
  createdAt: string;
  updatedAt: string;
};

export type ShipmentsResponse = {
  items: ShipmentItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type ShipmentSimCardsResponse = {
  items: Array<{
    id: string;
    iccid: string;
    ipAddress: string;
    publicIpAddress?: string | null;
    status: string;
    assignedTo?: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    } | null;
  }>;
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

export type ImportColumnMapping = {
  iccid?: string;
  ipAddress?: string;
  publicIpAddress?: string;
  phoneNumber?: string;
  apn?: string;
};

export type ImportPreviewRow = {
  rowNumber: number;
  data: {
    iccid: string | null;
    ipAddress: string | null;
    publicIpAddress: string | null;
    phoneNumber: string | null;
    apn: string | null;
  };
  errors: string[];
  warning: string[];
};

export type ImportSummary = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicatesInFile: number;
  duplicatesInDatabase: number;
};

export type ShipmentImportPreview = {
  mode: 'preview';
  headers: string[];
  resolvedMapping: Record<string, string | null>;
  summary: ImportSummary;
  previewRows: ImportPreviewRow[];
  canImport: boolean;
};

export type ShipmentImportApply = {
  mode: 'import';
  fileName: string;
  insertedRows: number;
  totalRows: number;
  summary: ImportSummary;
  resolvedMapping: Record<string, string | null>;
};
