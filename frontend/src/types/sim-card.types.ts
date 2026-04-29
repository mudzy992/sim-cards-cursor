export type SimCardStatus =
  | 'AVAILABLE'
  | 'ASSIGNED'
  | 'INSTALLED'
  | 'DEFECTIVE'
  | 'DEMOUNTED'
  | 'RETURNED'
  | 'DEACTIVATED';

export type SimEventItem = {
  id: string;
  type: string;
  createdAt: string;
  metadata: unknown;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
};

export type SimCardListParams = {
  page?: number;
  limit?: number;
  search?: string;
  status?: SimCardStatus;
  shipmentId?: string;
};

export type SimCardItem = {
  id: string;
  iccid: string;
  ipAddress: string;
  publicIpAddress?: string | null;
  status: SimCardStatus;
  phoneNumber?: string | null;
  apn?: string | null;
  assignedAt?: string | null;
  assignedTo?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    status: string;
  } | null;
  shipment: {
    id: string;
    name: string;
    provider: string;
    receivedDate: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type ModeratedInstalledSimCardItem = SimCardItem & {
  meter: {
    id: string;
    serialNumber: string;
    branch: {
      id: string;
      name: string;
      code: string;
    } | null;
  } | null;
  installedAt: string | null;
};

export type ModeratedInstalledSimCardsResponse = {
  items: ModeratedInstalledSimCardItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type SimCardsResponse = {
  items: SimCardItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
