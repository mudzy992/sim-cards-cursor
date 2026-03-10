export type SimCardStatus =
  | 'AVAILABLE'
  | 'ASSIGNED'
  | 'INSTALLED'
  | 'DEFECTIVE'
  | 'RETURNED'
  | 'DEACTIVATED';

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

export type SimCardsResponse = {
  items: SimCardItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
