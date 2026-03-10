export type ParsedExcelRow = Record<string, string | number | null | undefined>;

export interface ParsedExcelPreview {
  headers: string[];
  rows: ParsedExcelRow[];
}
