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
  meterId: string;
  simCard?: {
    id: string;
    iccid: string;
    ipAddress: string;
    status: string;
  } | null;
  installationAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  city?: string | null;
  municipality?: string | null;
  installationDate: string;
  installedById: string;
  status: RecordStatus;
  approvedById?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  sentToEmail?: string | null;
  sentAt?: string | null;
  pdfPath?: string | null;
  notes?: string | null;
  photos?: string[] | null;
  meterNumber?: string | null;
  createdAt: string;
  updatedAt: string;
  meter?: {
    id: string;
    serialNumber: string;
    meterTypeDefinitionId?: string;
    installationAddress?: string | null;
    installationDate?: string | null;
    city?: string | null;
    municipality?: string | null;
    measuringPoint?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    year?: number | null;
    calibrationYear?: number | null;
    dynamicFieldValues?: Record<string, unknown> | null;
    meterTypeDefinition?: { name: string } | null;
    simCard?: {
      id: string;
      iccid: string;
      ipAddress: string;
      status: string;
    } | null;
  } | null;
  installedBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  approvedBy?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
};

export type InstallationRecordsListParams = {
  page?: number;
  limit?: number;
  status?: RecordStatus;
  meterId?: string;
};

export type InstallationRecordsResponse = {
  items: InstallationRecordItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
