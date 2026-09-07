export type ImportColumnMapping = {
  iccid?: string;
  ipAddress?: string;
  publicIpAddress?: string;
  phoneNumber?: string;
  apn?: string;
};

export type ImportIssueCode =
  | 'ICCID_REQUIRED'
  | 'ICCID_INVALID'
  | 'IP_REQUIRED'
  | 'IP_INVALID'
  | 'PUBLIC_IP_INVALID'
  | 'DUPLICATE_IN_FILE'
  | 'DUPLICATE_IN_DATABASE';

export type ImportIssueSeverity = 'error' | 'warning';

export interface ImportIssue {
  code: ImportIssueCode;
  severity: ImportIssueSeverity;
  message: string;
}

export interface DuplicateSource {
  shipmentId: string;
  shipmentName: string;
  receivedDate: string;
  firstRowNumber?: number;
}

export interface ImportPreviewRow {
  rowNumber: number;
  data: {
    iccid: string | null;
    ipAddress: string | null;
    publicIpAddress: string | null;
    phoneNumber: string | null;
    apn: string | null;
  };
  issues: ImportIssue[];
  duplicateOf?: DuplicateSource | null;
  duplicateInFileOfRow?: number | null;
  importable: boolean;
}

export interface ImportSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicatesInFile: number;
  duplicatesInDatabase: number;
}

export interface ShipmentImportPreview {
  mode: 'preview';
  fileName: string;
  headers: string[];
  resolvedMapping: Record<string, string | null>;
  summary: ImportSummary;
  previewRows: ImportPreviewRow[];
  canImport: boolean;
}

export interface ShipmentImportApply {
  mode: 'import';
  fileName: string;
  insertedRows: number;
  skippedRows: number;
  totalRows: number;
  summary: ImportSummary;
}

export const issueLabel = (issue: ImportIssue): string => issue.message;

/** Sve poruke reda spojene u jedan string (za CSV / print). */
export const issuesToText = (row: ImportPreviewRow): string =>
  row.issues.map((i) => i.message).join(' | ');

export interface BackendPreviewRow {
  rowNumber: number;
  data: ImportPreviewRow['data'];
  errors: string[];
  warning: string[];
  duplicateOf?: {
    shipmentId: string;
    shipmentName: string;
    receivedDate: string | Date;
  } | null;
  duplicateInFileOfRow?: number | null;
  importable?: boolean;
}

export interface BackendShipmentImportPreview {
  mode: 'preview';
  fileName: string;
  headers: string[];
  resolvedMapping: Record<string, string | null>;
  summary: ImportSummary;
  previewRows: BackendPreviewRow[];
  canImport: boolean;
}

function classifyIssue(message: string): ImportIssueCode {
  if (message.includes('Duplikat unutar fajla')) return 'DUPLICATE_IN_FILE';
  if (message.includes('već postoji u isporuci')) return 'DUPLICATE_IN_DATABASE';
  if (message.includes('ICCID nedostaje')) return 'ICCID_REQUIRED';
  if (message.includes('ICCID')) return 'ICCID_INVALID';
  if (message.includes('Interna IP') && message.includes('nedostaje')) return 'IP_REQUIRED';
  if (message.includes('Interna IP')) return 'IP_INVALID';
  if (message.includes('Javna IP')) return 'PUBLIC_IP_INVALID';
  return 'ICCID_INVALID';
}

export function normalizePreviewRow(row: BackendPreviewRow): ImportPreviewRow {
  const issues: ImportIssue[] = [];

  for (const message of row.errors ?? []) {
    let code = classifyIssue(message);
    if (row.duplicateInFileOfRow != null && message.includes('Duplikat')) code = 'DUPLICATE_IN_FILE';
    if (row.duplicateOf && message.includes('isporuci')) code = 'DUPLICATE_IN_DATABASE';
    issues.push({ code, severity: 'error', message });
  }
  for (const message of row.warning ?? []) {
    if ((row.errors ?? []).includes(message)) continue;
    issues.push({ code: classifyIssue(message), severity: 'warning', message });
  }

  return {
    rowNumber: row.rowNumber,
    data: row.data,
    issues,
    duplicateOf: row.duplicateOf
      ? {
          shipmentId: row.duplicateOf.shipmentId,
          shipmentName: row.duplicateOf.shipmentName,
          receivedDate: String(row.duplicateOf.receivedDate),
        }
      : null,
    duplicateInFileOfRow: row.duplicateInFileOfRow ?? null,
    importable: (row.errors?.length ?? 0) === 0,
  };
}
