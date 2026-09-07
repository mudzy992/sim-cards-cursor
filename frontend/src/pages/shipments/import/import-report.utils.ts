/**
 * Izvještaji o redovima sa greškom: CSV export i print (A4).
 * Nezavisno od UI biblioteke — čist DOM/Blob, radi i na zatvorenoj mreži.
 */
import type { ImportPreviewRow } from '@/types/import.types';

const CSV_HEADERS = [
  'Red',
  'ICCID',
  'Interna IP',
  'Javna IP',
  'Broj telefona',
  'APN',
  'Greške',
  'Duplikat iz isporuke',
  'Datum prijema isporuke',
];

const csvEscape = (value: string | null | undefined): string => {
  const v = value ?? '';
  return /[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
};

const rowToCells = (row: ImportPreviewRow): string[] => [
  String(row.rowNumber),
  row.data.iccid ?? '',
  row.data.ipAddress ?? '',
  row.data.publicIpAddress ?? '',
  row.data.phoneNumber ?? '',
  row.data.apn ?? '',
  row.issues.map((i) => i.message).join(' | '),
  row.duplicateOf?.shipmentName ?? '',
  row.duplicateOf ? new Date(row.duplicateOf.receivedDate).toLocaleDateString('bs-BA') : '',
];

/**
 * CSV sa `;` separatorom i BOM-om → Excel na Windowsu ispravno otvara
 * naša slova (č, ć, ž, š, đ) bez dodatnog podešavanja.
 */
export function exportIssuesToCsv(rows: ImportPreviewRow[], fileName: string): void {
  const lines = [
    CSV_HEADERS.join(';'),
    ...rows.map((row) => rowToCells(row).map(csvEscape).join(';')),
  ];
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.replace(/\.(xlsx|xls|csv)$/i, '') + '_greske.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Print izvještaja o greškama u zasebnom prozoru (ne dira glavni DOM). */
export function printIssuesReport(
  rows: ImportPreviewRow[],
  meta: { fileName: string; shipmentName: string },
): void {
  const win = window.open('', '_blank', 'width=1024,height=768');
  if (!win) return;

  const bodyRows = rows
    .map(
      (row) => `
      <tr>
        <td class="num">${row.rowNumber}</td>
        <td class="mono">${escapeHtml(row.data.iccid ?? '—')}</td>
        <td class="mono">${escapeHtml(row.data.ipAddress ?? '—')}</td>
        <td>${row.issues.map((i) => `<div class="issue">${escapeHtml(i.message)}</div>`).join('')}</td>
      </tr>`,
    )
    .join('');

  win.document.write(`<!doctype html>
<html lang="bs"><head><meta charset="utf-8" />
<title>Greške u importu — ${escapeHtml(meta.fileName)}</title>
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
  <h1>Izvještaj o greškama pri importu</h1>
  <div class="meta">
    Isporuka: <strong>${escapeHtml(meta.shipmentName)}</strong> ·
    Fajl: <strong>${escapeHtml(meta.fileName)}</strong> ·
    Redova sa greškom: <strong>${rows.length}</strong> ·
    Izvještaj generisan: ${new Date().toLocaleString('bs-BA')}
  </div>
  <table>
    <thead><tr><th>Red</th><th>ICCID</th><th>Interna IP</th><th>Opis greške</th></tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 350);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
