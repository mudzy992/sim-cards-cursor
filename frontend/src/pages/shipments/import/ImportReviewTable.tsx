import { useMemo, useState } from 'react';
import { Alert, Button, Card, Space, Table, Tooltip } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DownloadOutlined,
  PrinterOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { ImportPreviewRow, ShipmentImportPreview } from '@/types/import.types';
import { exportIssuesToCsv, printIssuesReport } from './import-report.utils';
import { useTranslation } from '@/i18n';
import { StatusBadge } from '@/components/ui';
import { FALLBACK_DASH } from '@/constants/ui';
import { formatDate, formatNumber, getActiveIntlLocale } from '@/utils/formatters';

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
  const dateLocale = getActiveIntlLocale(language);
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
      render: (n: number) => <span className="font-mono text-xs text-fg-muted">{n}</span>,
    },
    {
      title: t('common.labels.status'),
      key: 'status',
      width: 74,
      align: 'center',
      render: (_, row) =>
        row.importable ? (
          <Tooltip title={t('shipments.importReview.rowValid')}>
            <CheckCircleOutlined
              className="text-base text-status-success-fg"
              aria-label={t('shipments.importReview.rowValid')}
            />
          </Tooltip>
        ) : (
          <Tooltip title={t('shipments.importReview.rowInvalid')}>
            <CloseCircleOutlined
              className="text-base text-status-danger-fg"
              aria-label={t('shipments.importReview.rowInvalid')}
            />
          </Tooltip>
        ),
    },
    {
      title: 'ICCID',
      key: 'iccid',
      render: (_, row) => (
        <span className={`font-mono text-xs ${row.importable ? 'text-fg-primary' : 'text-status-danger-fg'}`}>
          {row.data.iccid ?? FALLBACK_DASH}
        </span>
      ),
    },
    {
      title: t('shipments.importReview.internalIp'),
      key: 'ip',
      render: (_, row) => (
        <span className="font-mono text-xs text-fg-primary">
          {row.data.ipAddress ?? FALLBACK_DASH}
        </span>
      ),
    },
    {
      title: t('simCards.details.publicIp'),
      key: 'publicIp',
      render: (_, row) => (
        <span className="font-mono text-xs text-fg-secondary">
          {row.data.publicIpAddress ?? FALLBACK_DASH}
        </span>
      ),
    },
    {
      title: t('common.labels.phone'),
      key: 'phoneNumber',
      render: (_, row) => (
        <span className="font-mono text-xs text-fg-secondary">
          {row.data.phoneNumber ?? FALLBACK_DASH}
        </span>
      ),
    },
    {
      title: t('shipments.importReview.issueColumn'),
      key: 'issues',
      width: '38%',
      render: (_, row) =>
        row.issues.length === 0 ? (
          <span className="text-xs text-fg-muted">{FALLBACK_DASH}</span>
        ) : (
          <div className="space-y-1">
            {row.issues.map((issue, i) => (
              <div key={i} className="flex flex-wrap items-baseline gap-1.5 text-xs leading-snug">
                <StatusBadge
                  tone={issue.severity === 'error' ? 'danger' : 'warning'}
                  label={
                    issue.severity === 'error'
                      ? t('shipments.importReview.error')
                      : t('shipments.importReview.warning')
                  }
                />
                <span
                  className={
                    issue.severity === 'error'
                      ? 'text-status-danger-fg'
                      : 'text-status-warning-fg'
                  }
                >
                  {issue.message}
                </span>
              </div>
            ))}
            {row.duplicateOf ? (
              <div className="mt-1 rounded border border-status-danger-border bg-status-danger-bg px-2 py-1 text-[11px] text-status-danger-fg">
                {t('shipments.importReview.originalShipment')}{' '}
                <strong>{row.duplicateOf.shipmentName}</strong> ·{' '}
                {t('shipments.details.receivedDate').toLowerCase()}{' '}
                <strong>{formatDate(row.duplicateOf.receivedDate, language)}</strong>
              </div>
            ) : null}
          </div>
        ),
    },
  ];

  const filterButtons: Array<{ key: FilterKey; label: string; count: number; danger?: boolean }> = [
    { key: 'all', label: t('shipments.importReview.filterAll'), count: rows.length },
    { key: 'valid', label: t('shipments.importReview.filterValid'), count: importableCount },
    {
      key: 'errors',
      label: t('shipments.importReview.filterErrors'),
      count: errorRows.length,
      danger: true,
    },
    { key: 'dupFile', label: t('shipments.importReview.filterDupFile'), count: dupFileRows.length },
    { key: 'dupDb', label: t('shipments.importReview.filterDupDb'), count: dupDbRows.length },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <SummaryBox
          label={t('shipments.importReview.summaryTotal')}
          value={formatNumber(preview.summary.totalRows, language)}
        />
        <SummaryBox
          label={t('shipments.importReview.summaryValid')}
          value={formatNumber(preview.summary.validRows, language)}
          tone="ok"
        />
        <SummaryBox
          label={t('shipments.importReview.summaryInvalid')}
          value={formatNumber(preview.summary.invalidRows, language)}
          tone="err"
        />
        <SummaryBox
          label={t('shipments.importReview.summaryDupFile')}
          value={formatNumber(preview.summary.duplicatesInFile, language)}
          tone="warn"
        />
        <SummaryBox
          label={t('shipments.importReview.summaryDupDb')}
          value={formatNumber(preview.summary.duplicatesInDatabase, language)}
          tone="warn"
        />
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
                onClick={() => exportIssuesToCsv(errorRows, preview.fileName, t, dateLocale)}
              >
                {t('shipments.importReview.csvErrors')}
              </Button>
              <Button
                size="small"
                icon={<PrinterOutlined />}
                onClick={() =>
                  printIssuesReport(
                    errorRows,
                    { fileName: preview.fileName, shipmentName },
                    t,
                    dateLocale,
                  )
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

      <Card size="small" className="border-subtle bg-surface shadow-sm">
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
            <span className="text-xs text-fg-secondary">
              {t('shipments.importReview.selectedLabel')}{' '}
              <strong className="text-fg-primary">{selectedRowNumbers.length}</strong> /{' '}
              {importableCount}
            </span>
            <Button
              size="small"
              onClick={() =>
                onChangeSelection(rows.filter((r) => r.importable).map((r) => r.rowNumber))
              }
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
        rowClassName={(row) => (row.importable ? '' : 'bg-status-danger-bg')}
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

function SummaryBox(props: { label: string; value: string; tone?: 'ok' | 'err' | 'warn' }) {
  const tone =
    props.tone === 'ok'
      ? 'border-status-success-border bg-status-success-bg text-status-success-fg'
      : props.tone === 'err'
        ? 'border-status-danger-border bg-status-danger-bg text-status-danger-fg'
        : props.tone === 'warn'
          ? 'border-status-warning-border bg-status-warning-bg text-status-warning-fg'
          : 'border-subtle bg-surface-sunken text-fg-primary';
  return (
    <div className={`rounded-md border px-3 py-2 ${tone}`}>
      <div className="text-[11px] uppercase tracking-wide opacity-85">{props.label}</div>
      <div className="text-xl font-semibold tabular-nums">{props.value}</div>
    </div>
  );
}
