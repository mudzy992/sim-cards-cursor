import { BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { ImportDomainKey } from './column-mapper.service';

type RawRow = Record<string, string>;

export type ParsedFile = {
  headers: string[];
  rows: RawRow[];
};

export type PreviewRow = {
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

export type PreviewSummary = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicatesInFile: number;
  duplicatesInDatabase: number;
};

export type ValidationResult = {
  rows: PreviewRow[];
  summary: PreviewSummary;
  canImport: boolean;
};

export type PreviewResponse = {
  headers: string[];
  resolvedMapping: Record<ImportDomainKey, string | null>;
  summary: PreviewSummary;
  previewRows: PreviewRow[];
  canImport: boolean;
};

const IPV4_REGEX =
  /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

function safeString(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).replace(/^\uFEFF/, '').trim();
}

function normalizeIccid(value: string): string {
  return value.replace(/\s+/g, '');
}

export class ExcelImportService {
  parse(fileBuffer: Buffer): ParsedFile {
    try {
      const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        throw new BadRequestException('Excel file does not contain any sheet');
      }

      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
        raw: false,
        defval: '',
      });

      if (rows.length === 0) {
        throw new BadRequestException('Excel file does not contain any data rows');
      }

      const headers = Object.keys(rows[0]);
      if (headers.length === 0) {
        throw new BadRequestException('Excel headers are missing');
      }

      const normalizedRows: RawRow[] = rows.map((row) => {
        const normalized: RawRow = {};
        headers.forEach((header) => {
          normalized[header] = safeString(row[header]);
        });
        return normalized;
      });

      return { headers, rows: normalizedRows };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Failed to parse uploaded file as Excel/CSV');
    }
  }

  validate(
    parsed: ParsedFile,
    mapping: Record<ImportDomainKey, string | null>,
    existingIccids: Set<string>,
  ): ValidationResult {
    if (!mapping.iccid || !mapping.ipAddress) {
      throw new BadRequestException('Column mapping must include iccid and ipAddress');
    }

    const seenInFile = new Set<string>();
    let duplicatesInFile = 0;
    let duplicatesInDatabase = 0;

    const rows: PreviewRow[] = parsed.rows.map((row, index) => {
      const rowNumber = index + 2;
      const errors: string[] = [];
      const warning: string[] = [];

      const iccidRaw = safeString(row[mapping.iccid!]);
      const iccid = iccidRaw ? normalizeIccid(iccidRaw) : null;
      const ipAddress = mapping.ipAddress ? safeString(row[mapping.ipAddress]) || null : null;
      const publicIpAddress = mapping.publicIpAddress
        ? safeString(row[mapping.publicIpAddress]) || null
        : null;
      const phoneNumber = mapping.phoneNumber ? safeString(row[mapping.phoneNumber]) || null : null;
      const apn = mapping.apn ? safeString(row[mapping.apn]) || null : null;

      if (!iccid) {
        errors.push('ICCID is required');
      } else if (!/^\d{10,30}$/.test(iccid)) {
        errors.push('ICCID format is invalid');
      }

      if (!ipAddress) {
        errors.push('ipAddress is required');
      } else if (!IPV4_REGEX.test(ipAddress)) {
        errors.push('ipAddress format is invalid');
      }

      if (publicIpAddress && !IPV4_REGEX.test(publicIpAddress)) {
        errors.push('publicIpAddress format is invalid');
      }

      if (iccid) {
        if (seenInFile.has(iccid)) {
          duplicatesInFile += 1;
          errors.push('Duplicate ICCID in uploaded file');
        }
        seenInFile.add(iccid);

        if (existingIccids.has(iccid)) {
          duplicatesInDatabase += 1;
          warning.push('ICCID already exists in database');
          errors.push('ICCID already exists in database');
        }
      }

      return {
        rowNumber,
        data: {
          iccid,
          ipAddress,
          publicIpAddress,
          phoneNumber,
          apn,
        },
        errors,
        warning,
      };
    });

    const validRows = rows.filter((row) => row.errors.length === 0).length;
    const summary: PreviewSummary = {
      totalRows: rows.length,
      validRows,
      invalidRows: rows.length - validRows,
      duplicatesInFile,
      duplicatesInDatabase,
    };

    return {
      rows,
      summary,
      canImport: summary.validRows > 0 && summary.invalidRows === 0,
    };
  }

  preview(
    parsed: ParsedFile,
    mapping: Record<ImportDomainKey, string | null>,
    existingIccids: Set<string>,
  ): PreviewResponse {
    const validation = this.validate(parsed, mapping, existingIccids);

    return {
      headers: parsed.headers,
      resolvedMapping: mapping,
      summary: validation.summary,
      previewRows: validation.rows,
      canImport: validation.canImport,
    };
  }

  toCreateManyData(rows: PreviewRow[], shipmentId: string) {
    return rows
      .filter((row) => row.errors.length === 0)
      .map((row) => ({
        iccid: row.data.iccid!,
        ipAddress: row.data.ipAddress!,
        publicIpAddress: row.data.publicIpAddress,
        phoneNumber: row.data.phoneNumber,
        apn: row.data.apn,
        shipmentId,
      }));
  }
}
