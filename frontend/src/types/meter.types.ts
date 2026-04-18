export type MeterType = 'SINGLE_PHASE' | 'THREE_PHASE';
export type MeterSimCardState = 'INSTALLED' | 'NO_SIM';

export type MeterTypeDefinitionRef = {
  id: string;
  name: string;
  manufacturer?: string | null;
  model?: string | null;
  type: MeterType;
  maxCurrent?: string | null;
};

export type MeterItem = {
  id: string;
  serialNumber: string;
  meterTypeDefinitionId: string;
  branchId?: string | null;
  meterTypeDefinition?: MeterTypeDefinitionRef | null;
  simCard?: { id: string; iccid: string; status: string; ipAddress?: string } | null;
  simCardState?: MeterSimCardState;
  noSimReason?: string | null;
  year?: number | null;
  calibrationYear?: number | null;
  notes?: string | null;
  installationAddress?: string | null;
  installationDate?: string | null;
  city?: string | null;
  municipality?: string | null;
  measuringPoint?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  dynamicFieldValues?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type MetersListParams = {
  page?: number;
  limit?: number;
  meterTypeDefinitionId?: string;
  serialNumber?: string;
};

export type MetersResponse = {
  items: MeterItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type CreateMeterInput = {
  serialNumber: string;
  meterTypeDefinitionId: string;
  year?: number;
  calibrationYear?: number;
  notes?: string;
  installationAddress?: string;
  installationDate?: string;
  city?: string;
  municipality?: string;
  measuringPoint?: string;
  dynamicFieldValues?: Record<string, unknown>;
  simCardId?: string;
  simCardState?: MeterSimCardState;
  noSimReason?: string;
};

export type UpdateMeterInput = Partial<CreateMeterInput>;
