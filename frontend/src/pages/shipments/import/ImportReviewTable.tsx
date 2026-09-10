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
import { useTranslation } from '@/i18n';

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
  const { t, language } = useTranslation();
  const dateLocale = language === 'bs' ? 'bs-BA' : 'en-US';
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
      title: t('common.labels.status'),
      key: 'status',
      width: 74,
      align: 'center',
      render: (_, row) =>
        row.importable ? (
          <Tooltip title={t('shipments.importReview.rowValid')}>
            <CheckCircleTwoTone twoToneColor="#16a34a" />
          </Tooltip>
        ) : (
          <Tooltip title={t('shipments.importReview.rowInvalid')}>
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
      title: t('shipments.importReview.internalIp'),
      key: 'ip',
      render: (_, row) => <span className="font-mono text-xs">{row.data.ipAddress ?? '—'}</span>,
    },
    {
      title: t('simCards.details.publicIp'),
      key: 'publicIp',
      render: (_, row) => (
        <span className="font-mono text-xs text-slate-500">{row.data.publicIpAddress ?? '—'}</span>
      ),
    },
    {
      title: t('shipments.importReview.issueColumn'),
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
                  {issue.severity === 'error' ? t('shipments.importReview.error') : t('shipments.importReview.warning')}
                </Tag>
                <span className={issue.severity === 'error' ? 'text-red-700' : 'text-amber-700'}>
                  {issue.message}
                </span>
              </div>
            ))}
            {row.duplicateOf ? (
              <div className="mt-1 rounded bg-red-50 px-2 py-1 text-[11px] text-red-800">
                {t('shipments.importReview.originalShipment')} <strong>{row.duplicateOf.shipmentName}</strong> · {t('shipments.details.receivedDate').toLowerCase()}{' '}
                <strong>
                  {new Date(row.duplicateOf.receivedDate).toLocaleDateString(dateLocale)}
                </strong>
              </div>
            ) : null}
          </div>
        ),
    },
  ];

  const filterButtons: Array<{ key: FilterKey; label: string; count: number; danger?: boolean }> = [
    { key: 'all', label: t('shipments.importReview.filterAll'), count: rows.length },
    { key: 'valid', label: t('shipments.importReview.filterValid'), count: importableCount },
    { key: 'errors', label: t('shipments.importReview.filterErrors'), count: errorRows.length, danger: true },
    { key: 'dupFile', label: t('shipments.importReview.filterDupFile'), count: dupFileRows.length },
    { key: 'dupDb', label: t('shipments.importReview.filterDupDb'), count: dupDbRows.length },
  ];

  return (
    <div className="space-y-4">
      {/* sažetak */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <SummaryBox label={t('shipments.importReview.summaryTotal')} value={preview.summary.totalRows} />
        <SummaryBox label={t('shipments.importReview.summaryValid')} value={preview.summary.validRows} tone="ok" />
        <SummaryBox label={t('shipments.importReview.summaryInvalid')} value={preview.summary.invalidRows} tone="err" />
        <SummaryBox label={t('shipments.importReview.summaryDupFile')} value={preview.summary.duplicatesInFile} tone="warn" />
        <SummaryBox label={t('shipments.importReview.summaryDupDb')} value={preview.summary.duplicatesInDatabase} tone="warn" />
      </div>

      {errorRows.length > 0 ? (
        <Alert
          type="warning"
          showIcon
          message={t('shipments.importReview.rowsHaveErrors', { count: errorRows.length })}
          description={t('shipments.importReview.errorsDescription')}
          action={
            <Space direction="vertical" size={4}>
              <Button
                size="small"
                icon={<DownloadOutlined />}
                onClick={() => exportIssuesToCsv(errorRows, preview.fileName)}
              >
                {t('shipments.importReview.csvErrors')}
              </Button>
              <Button
                size="small"
                icon={<PrinterOutlined />}
                onClick={() =>
                  printIssuesReport(errorRows, { fileName: preview.fileName, shipmentName })
                }
              >
                {t('common.actions.print')}
              </Button>
            </Space>
          }
        />
      ) : (
        <Alert type="success" showIcon message={t('shipments.importReview.allRowsValid')} />
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
              {t('shipments.importReview.selectedLabel')} <strong>{selectedRowNumbers.length}</strong> / {importableCount}
            </Typography.Text>
            <Button
              size="small"
              onClick={() => onChangeSelection(rows.filter((r) => r.importable).map((r) => r.rowNumber))}
            >
              {t('shipments.importReview.selectAllValid')}
            </Button>
            <Button size="small" onClick={() => onChangeSelection([])}>
              {t('common.actions.deselectAll')}
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
            title: row.importable ? undefined : t('shipments.importReview.cannotImportErrorRow'),
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
      <div className="text-xl font-semibold">{props.value.toLocaleString()}</div>
    </div>
  );
}
