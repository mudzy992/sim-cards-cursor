import type { ImportPreviewRow } from '@/types/import.types';

type TFn = (key: string) => string

function getCsvHeaders(t: TFn): string[] {
  return [
    t('shipments.importReport.rowHeader'),
    'ICCID',
    t('shipments.importReport.internalIpHeader'),
    t('simCards.details.publicIp'),
    t('common.labels.phone'),
    'APN',
    t('shipments.importReport.errorsHeader'),
    t('shipments.importReport.duplicateOfHeader'),
    t('shipments.importReport.shipmentReceivedDateHeader'),
  ]
}

const csvEscape = (value: string | null | undefined): string => {
  const v = value != null ? String(value) : '';
  return /[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
};

const rowToCells = (row: ImportPreviewRow, dateLocale: string): string[] => [
  String(row.rowNumber ?? ''),
  row.data?.iccid ?? '',
  row.data?.ipAddress ?? '',
  row.data?.publicIpAddress ?? '',
  row.data?.phoneNumber ?? '',
  row.data?.apn ?? '',
  (row.issues ?? [])
    .map((i) => i?.message || '')
    .filter(Boolean)
    .join(' | '),
  row.duplicateOf?.shipmentName ?? '',
  row.duplicateOf?.receivedDate
    ? new Date(row.duplicateOf.receivedDate).toLocaleDateString(dateLocale)
    : '',
];

/**
 * CSV sa `;` separatorom i BOM-om → Excel na Windowsu ispravno otvara
 * naša slova (č, ć, ž, š, đ) bez dodatnog podešavanja.
 */
export function exportIssuesToCsv(
  rows: ImportPreviewRow[],
  fileName?: string | null,
  t: TFn = (key) => key,
  dateLocale = 'bs-BA',
): void {
  const safeName = (fileName && typeof fileName === 'string' ? fileName : 'import_kartica')
    .replace(/\.(xlsx|xls|csv)$/i, '');

  const lines = [
    getCsvHeaders(t).join(';'),
    ...rows.map((row) => rowToCells(row, dateLocale).map(csvEscape).join(';')),
  ];
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeName}_greske.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Print izvještaja o greškama u zasebnom prozoru (ne dira glavni DOM). */
export function printIssuesReport(
  rows: ImportPreviewRow[],
  meta?: { fileName?: string | null; shipmentName?: string | null },
  t: TFn = (key) => key,
  dateLocale = 'bs-BA',
): void {
  const win = window.open('', '_blank', 'width=1024,height=768');
  if (!win) return;

  const safeFileName = meta?.fileName || 'import_kartica';
  const safeShipmentName = meta?.shipmentName || t('shipments.importReport.shipmentFallback');

  const bodyRows = rows
    .map(
      (row) => `
      <tr>
        <td class="num">${row.rowNumber ?? ''}</td>
        <td class="mono">${escapeHtml(row.data?.iccid ?? '—')}</td>
        <td class="mono">${escapeHtml(row.data?.ipAddress ?? '—')}</td>
        <td>${(row.issues ?? [])
          .map((i) => `<div class="issue">${escapeHtml(i?.message || '')}</div>`)
          .join('')}</td>
      </tr>`,
    )
    .join('');

  win.document.write(`<!doctype html>
<html lang="${dateLocale.startsWith('en') ? 'en' : 'bs'}"><head><meta charset="utf-8" />
<title>${escapeHtml(t('shipments.importReport.printTitle'))} — ${escapeHtml(safeFileName)}</title>
<style>
  @page { size: A4 portrait; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color: #0f172a; margin: 0; }
  h1 { font-size: 16pt; margin: 0 0 4px; }
  .meta { font-size: 9pt; color: #475569; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  th { background: #f1f5f9; text-align: left; border: 0.5pt solid #94a3b8; padding: 4px 6px; }
  td { border: 0.5pt solid #cbd5e1; padding: 4px 6px; vertical-align: top; }
  td.num { text-align: right; width: 34px; color: #64748b; }
  .mono { font-family: ui-monospace, Consolas, monospace; white-space: nowrap; }
  .issue { color: #b91c1c; }
  tr { break-inside: avoid; }
  thead { display: table-header-group; }
</style></head>
<body>
  <h1>${escapeHtml(t('shipments.importReport.printTitle'))}</h1>
  <div class="meta">
    ${escapeHtml(t('shipments.import.shipmentPrefix'))} <strong>${escapeHtml(safeShipmentName)}</strong> ·
    ${escapeHtml(t('shipments.import.filePrefix'))} <strong>${escapeHtml(safeFileName)}</strong> ·
    ${escapeHtml(t('shipments.importReport.rowsWithErrors'))} <strong>${rows.length}</strong> ·
    ${escapeHtml(t('shipments.importReport.reportGenerated'))} ${new Date().toLocaleString(dateLocale)}
  </div>
  <table>
    <thead><tr><th>${escapeHtml(t('shipments.importReport.rowHeader'))}</th><th>ICCID</th><th>${escapeHtml(t('shipments.importReport.internalIpHeader'))}</th><th>${escapeHtml(t('shipments.importReport.errorDescriptionHeader'))}</th></tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 350);
}

function escapeHtml(text: unknown): string {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
