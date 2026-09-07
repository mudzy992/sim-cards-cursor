import { useMemo, useState } from 'react';
import { Alert, Button, Card, Space, Table, Tag, Tooltip, Typography } from 'antd';
import {
  CheckCircleTwoTone,
  CloseCircleTwoTone,
  DownloadOutlined,
  PrinterOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { ImportPreviewRow, ShipmentImportPreview } from '@/types/import.types';
import { exportIssuesToCsv, printIssuesReport } from './import-report.utils';

/**
 * Review importa: pregled svih redova sa greškama/upozorenjima,
 * čekiranje redova koji idu u isporuku, te izvještaji (CSV / print).
 *
 * Selekcija je kontrolisana izvana (parent drži listu rowNumber-a),
 * kako bi "Uvezi" dugme moglo biti u wizard footeru.
 */
export interface ImportReviewTableProps {
  preview: ShipmentImportPreview;
  shipmentName: string;
  selectedRowNumbers: number[];
  onChangeSelection: (rowNumbers: number[]) => void;
}

type FilterKey = 'all' | 'valid' | 'errors' | 'dupFile' | 'dupDb';

export function ImportReviewTable(props: ImportReviewTableProps) {
  const { preview, shipmentName, selectedRowNumbers, onChangeSelection } = props;
  const [filter, setFilter] = useState<FilterKey>('all');

  const rows = preview.previewRows;

  const errorRows = useMemo(() => rows.filter((r) => !r.importable), [rows]);
  const dupFileRows = useMemo(
    () => rows.filter((r) => r.issues.some((i) => i.code === 'DUPLICATE_IN_FILE')),
    [rows],
  );
  const dupDbRows = useMemo(
    () => rows.filter((r) => r.issues.some((i) => i.code === 'DUPLICATE_IN_DATABASE')),
    [rows],
  );

  const visibleRows = useMemo(() => {
    switch (filter) {
      case 'valid':
        return rows.filter((r) => r.importable);
      case 'errors':
        return errorRows;
      case 'dupFile':
        return dupFileRows;
      case 'dupDb':
        return dupDbRows;
      default:
        return rows;
    }
  }, [filter, rows, errorRows, dupFileRows, dupDbRows]);

  const selectedSet = useMemo(() => new Set(selectedRowNumbers), [selectedRowNumbers]);
  const importableCount = rows.length - errorRows.length;

  const columns: ColumnsType<ImportPreviewRow> = [
    {
      title: '#',
      dataIndex: 'rowNumber',
      width: 60,
      align: 'right',
      render: (n: number) => <span className="text-xs text-slate-400">{n}</span>,
    },
    {
      title: 'Status',
      key: 'status',
      width: 74,
      align: 'center',
      render: (_, row) =>
        row.importable ? (
          <Tooltip title="Red je ispravan">
            <CheckCircleTwoTone twoToneColor="#16a34a" />
          </Tooltip>
        ) : (
          <Tooltip title="Red ima grešku i ne može se uvesti">
            <CloseCircleTwoTone twoToneColor="#dc2626" />
          </Tooltip>
        ),
    },
    {
      title: 'ICCID',
      key: 'iccid',
      render: (_, row) => (
        <span className={`font-mono text-xs ${row.importable ? '' : 'text-red-600'}`}>
          {row.data.iccid ?? '—'}
        </span>
      ),
    },
    {
      title: 'Interna IP',
      key: 'ip',
      render: (_, row) => <span className="font-mono text-xs">{row.data.ipAddress ?? '—'}</span>,
    },
    {
      title: 'Javna IP',
      key: 'publicIp',
      render: (_, row) => (
        <span className="font-mono text-xs text-slate-500">{row.data.publicIpAddress ?? '—'}</span>
      ),
    },
    {
      title: 'Problem',
      key: 'issues',
      width: '38%',
      render: (_, row) =>
        row.issues.length === 0 ? (
          <span className="text-xs text-slate-400">—</span>
        ) : (
          <div className="space-y-1">
            {row.issues.map((issue, i) => (
              <div key={i} className="text-xs leading-snug">
                <Tag
                  color={issue.severity === 'error' ? 'red' : 'gold'}
                  className="!me-1 !text-[10px]"
                >
                  {issue.severity === 'error' ? 'greška' : 'upozorenje'}
                </Tag>
                <span className={issue.severity === 'error' ? 'text-red-700' : 'text-amber-700'}>
                  {issue.message}
                </span>
              </div>
            ))}
            {row.duplicateOf ? (
              <div className="mt-1 rounded bg-red-50 px-2 py-1 text-[11px] text-red-800">
                Izvorna isporuka: <strong>{row.duplicateOf.shipmentName}</strong> · datum prijema{' '}
                <strong>
                  {new Date(row.duplicateOf.receivedDate).toLocaleDateString('bs-BA')}
                </strong>
              </div>
            ) : null}
          </div>
        ),
    },
  ];

  const filterButtons: Array<{ key: FilterKey; label: string; count: number; danger?: boolean }> = [
    { key: 'all', label: 'Svi redovi', count: rows.length },
    { key: 'valid', label: 'Ispravni', count: importableCount },
    { key: 'errors', label: 'Sa greškom', count: errorRows.length, danger: true },
    { key: 'dupFile', label: 'Duplikat u fajlu', count: dupFileRows.length },
    { key: 'dupDb', label: 'Duplikat u bazi', count: dupDbRows.length },
  ];

  return (
    <div className="space-y-4">
      {/* sažetak */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <SummaryBox label="Ukupno redova" value={preview.summary.totalRows} />
        <SummaryBox label="Ispravnih" value={preview.summary.validRows} tone="ok" />
        <SummaryBox label="Sa greškom" value={preview.summary.invalidRows} tone="err" />
        <SummaryBox label="Duplikat u fajlu" value={preview.summary.duplicatesInFile} tone="warn" />
        <SummaryBox label="Duplikat u bazi" value={preview.summary.duplicatesInDatabase} tone="warn" />
      </div>

      {errorRows.length > 0 ? (
        <Alert
          type="warning"
          showIcon
          message={`${errorRows.length} red(ova) ima grešku i neće biti uvezeno`}
          description="Redovi sa greškom se ne mogu čekirati. Izvještaj možete izvesti u CSV ili odštampati, ispraviti u izvornom fajlu i ponoviti import."
          action={
            <Space direction="vertical" size={4}>
              <Button
                size="small"
                icon={<DownloadOutlined />}
                onClick={() => exportIssuesToCsv(errorRows, preview.fileName)}
              >
                CSV greške
              </Button>
              <Button
                size="small"
                icon={<PrinterOutlined />}
                onClick={() =>
                  printIssuesReport(errorRows, { fileName: preview.fileName, shipmentName })
                }
              >
                Štampaj
              </Button>
            </Space>
          }
        />
      ) : (
        <Alert type="success" showIcon message="Svi redovi u fajlu su ispravni." />
      )}

      {/* filteri + masovna selekcija */}
      <Card size="small" className="shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {filterButtons.map((btn) => (
            <Button
              key={btn.key}
              size="small"
              type={filter === btn.key ? 'primary' : 'default'}
              danger={btn.danger && filter === btn.key}
              onClick={() => setFilter(btn.key)}
            >
              {btn.label} ({btn.count})
            </Button>
          ))}
          <div className="ms-auto flex items-center gap-2">
            <Typography.Text className="text-xs text-slate-500">
              Odabrano: <strong>{selectedRowNumbers.length}</strong> / {importableCount}
            </Typography.Text>
            <Button
              size="small"
              onClick={() => onChangeSelection(rows.filter((r) => r.importable).map((r) => r.rowNumber))}
            >
              Označi sve ispravne
            </Button>
            <Button size="small" onClick={() => onChangeSelection([])}>
              Poništi izbor
            </Button>
          </div>
        </div>
      </Card>

      <Table<ImportPreviewRow>
        rowKey="rowNumber"
        size="small"
        dataSource={visibleRows}
        columns={columns}
        scroll={{ y: 420 }}
        pagination={{ pageSize: 50, showSizeChanger: true, pageSizeOptions: ['25', '50', '100'] }}
        rowClassName={(row) => (row.importable ? '' : 'bg-red-50/60')}
        rowSelection={{
          selectedRowKeys: visibleRows
            .filter((r) => selectedSet.has(r.rowNumber))
            .map((r) => r.rowNumber),
          getCheckboxProps: (row) => ({
            disabled: !row.importable,
            title: row.importable ? undefined : 'Red sa greškom se ne može uvesti',
          }),
          onSelect: (row, checked) => {
            const next = new Set(selectedRowNumbers);
            if (checked) next.add(row.rowNumber);
            else next.delete(row.rowNumber);
            onChangeSelection([...next].sort((a, b) => a - b));
          },
          onSelectAll: (checked) => {
            const next = new Set(selectedRowNumbers);
            for (const row of visibleRows) {
              if (!row.importable) continue;
              if (checked) next.add(row.rowNumber);
              else next.delete(row.rowNumber);
            }
            onChangeSelection([...next].sort((a, b) => a - b));
          },
        }}
      />
    </div>
  );
}

function SummaryBox(props: { label: string; value: number; tone?: 'ok' | 'err' | 'warn' }) {
  const tone =
    props.tone === 'ok'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
      : props.tone === 'err'
        ? 'bg-red-50 text-red-700 ring-red-200'
        : props.tone === 'warn'
          ? 'bg-amber-50 text-amber-700 ring-amber-200'
          : 'bg-slate-50 text-slate-700 ring-slate-200';
  return (
    <div className={`rounded-md px-3 py-2 ring-1 ${tone}`}>
      <div className="text-[11px] uppercase tracking-wide opacity-70">{props.label}</div>
      <div className="text-xl font-semibold">{props.value.toLocaleString('bs-BA')}</div>
    </div>
  );
}
