import { BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { ImportDomainKey } from './column-mapper.service';

type RawRow = Record<string, string>;

export type ParsedFile = { headers: string[]; rows: RawRow[] };

/** Izvorna isporuka postojećeg ICCID-a (za duplikat info u preview-u). */
export type ExistingIccidInfo = {
  shipmentId: string;
  shipmentName: string;
  receivedDate: Date;
};

export type ExistingIccidMap = Map<string, ExistingIccidInfo>;

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
  /** popunjeno kad je ICCID duplikat iz ranije isporuke */
  duplicateOf?: ExistingIccidInfo | null;
  /** popunjeno kad je ICCID duplikat unutar istog fajla (broj reda originala) */
  duplicateInFileOfRow?: number | null;
  /** true ako red nema grešaka (upozorenja ne blokiraju) */
  importable: boolean;
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
  return String(value).replace(/^﻿/, '').trim();
}

function normalizeIccid(value: string): string {
  return value.replace(/\s+/g, '');
}

/** dd.mm.yyyy bez oslanjanja na serverski locale. */
function formatBsDate(input: Date | string): string {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return String(input);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()}`;
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
      const rows = XLSX.utils.sheet_to_json<RawRow>(worksheet, {
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
    existing: ExistingIccidMap,
  ): ValidationResult {
    if (!mapping.iccid || !mapping.ipAddress) {
      throw new BadRequestException('Column mapping must include iccid and ipAddress');
    }

    const seenInFile = new Map<string, number>();
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
        errors.push('ICCID nedostaje');
      } else if (!/^\d{10,30}$/.test(iccid)) {
        errors.push('ICCID nije ispravan (očekuje se 10–30 cifara)');
      }

      if (!ipAddress) {
        errors.push('Interna IP adresa nedostaje');
      } else if (!IPV4_REGEX.test(ipAddress)) {
        errors.push(`Interna IP adresa nije ispravna (${ipAddress})`);
      }

      if (publicIpAddress && !IPV4_REGEX.test(publicIpAddress)) {
        errors.push(`Javna IP adresa nije ispravna (${publicIpAddress})`);
      }

      let duplicateInFileOfRow: number | null = null;
      let duplicateOf: ExistingIccidInfo | null = null;

      if (iccid) {
        // duplikat unutar fajla → uz redni broj prvog pojavljivanja
        const firstRow = seenInFile.get(iccid);
        if (firstRow !== undefined) {
          duplicatesInFile += 1;
          duplicateInFileOfRow = firstRow;
          errors.push(`Duplikat unutar fajla — isti ICCID je već u redu ${firstRow}`);
        } else {
          seenInFile.set(iccid, rowNumber);
        }

        // duplikat iz baze → uz naziv isporuke i datum prijema
        const hit = existing.get(iccid);
        if (hit) {
          duplicatesInDatabase += 1;
          duplicateOf = hit;
          errors.push(
            `ICCID već postoji u isporuci „${hit.shipmentName}" (prijem ${formatBsDate(hit.receivedDate)})`,
          );
        }
      }

      return {
        rowNumber,
        data: { iccid, ipAddress, publicIpAddress, phoneNumber, apn },
        errors,
        warning,
        duplicateOf,
        duplicateInFileOfRow,
        importable: errors.length === 0,
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

    // IZMJENA: parcijalni import je dozvoljen — dovoljan je bar jedan ispravan red
    return { rows, summary, canImport: summary.validRows > 0 };
  }

  preview(
    parsed: ParsedFile,
    mapping: Record<ImportDomainKey, string | null>,
    existing: ExistingIccidMap,
  ): PreviewResponse {
    const validation = this.validate(parsed, mapping, existing);

    return {
      headers: parsed.headers,
      resolvedMapping: mapping,
      summary: validation.summary,
      previewRows: validation.rows,
      canImport: validation.canImport,
    };
  }

  /**
   * Priprema redove za createMany — uzima SAMO ispravne redove, i to samo one
   * koje je korisnik označio u review-u (ako je selekcija proslijeđena).
   */
  toCreateManyData(
    rows: PreviewRow[],
    shipmentId: string,
    selectedRowNumbers?: number[],
  ) {
    const selected =
      selectedRowNumbers && selectedRowNumbers.length > 0 ? new Set(selectedRowNumbers) : null;

    return rows
      .filter((row) => row.errors.length === 0)
      .filter((row) => (selected ? selected.has(row.rowNumber) : true))
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
