import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import type {
  LabelLineSpec,
  LabelSheetLayout,
  LabelSlot,
  PrintableSimCard,
} from './label-formats';
import { MM_TO_PX, filledInSheet, formatMm } from './label-formats';
import { SimLabelContent } from './SimLabelContent';
import { useTranslation } from '@/i18n';
import { StatusBadge } from '@/components/ui';

export interface LabelSheetPreviewProps {
  cells: LabelSlot<PrintableSimCard>[];
  layout: LabelSheetLayout;
  scale: number;
  sheetNumber: number;
  totalSheets: number;
  interactive: boolean;
  showGuides: boolean;
  makeLines: (sim: PrintableSimCard) => LabelLineSpec[];
  lineGapMm: number;
  onPickStart?: (cellIndex: number) => void;
}

export function LabelSheetPreview(props: LabelSheetPreviewProps) {
  const { t } = useTranslation();
  const {
    cells,
    layout,
    scale,
    sheetNumber,
    totalSheets,
    interactive,
    showGuides,
    makeLines,
    lineGapMm,
    onPickStart,
  } = props;

  const sheetW = 210 * MM_TO_PX;
  const sheetH = 297 * MM_TO_PX;
  const filled = filledInSheet(cells);

  const gridStyle = useMemo<CSSProperties>(
    () => ({
      paddingTop: layout.marginTopMm * MM_TO_PX,
      paddingLeft: layout.marginLeftMm * MM_TO_PX,
      gridTemplateColumns: `repeat(${layout.columns}, ${layout.labelWidthMm * MM_TO_PX}px)`,
      gridAutoRows: layout.labelHeightMm * MM_TO_PX,
      columnGap: layout.gapXMm * MM_TO_PX,
      rowGap: layout.gapYMm * MM_TO_PX,
    }),
    [layout],
  );

  return (
    <div className="select-none">
      <div className="mb-2 flex items-center justify-between px-1 text-xs text-fg-secondary">
        <span className="inline-flex items-center gap-2 font-medium text-fg-primary">
          <span>{t('shipments.print.sheetOf', { sheet: sheetNumber, total: totalSheets })}</span>
          <span title={t('shipments.print.filledLabelsOnSheet')}>
            <StatusBadge
              tone={filled === cells.length ? 'success' : 'neutral'}
              label={`${filled}/${cells.length}`}
              mono
            />
          </span>
        </span>
        <span>
          A4 · {formatMm(layout.labelWidthMm)} × {formatMm(layout.labelHeightMm)} mm
        </span>
      </div>

      {/* vanjski okvir fiksne (skalirane) veličine; A4 papir je uvijek svijetli print-preview-scope */}
      <div
        style={{ width: sheetW * scale, height: sheetH * scale }}
        className="print-preview-scope relative overflow-hidden"
      >
        <div
          style={{
            width: sheetW,
            height: sheetH,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
          className="lp-preview-sheet absolute left-0 top-0"
        >
          <div className="grid" style={gridStyle}>
            {cells.map((cell, i) => {
              const classes = [
                'lp-preview-cell',
                showGuides ? 'lp-preview-cell--guides' : '',
                interactive ? 'lp-preview-cell--clickable' : '',
                cell.used ? 'lp-preview-cell--used' : '',
              ]
                .filter(Boolean)
                .join(' ');

              return interactive ? (
                <button
                  key={i}
                  type="button"
                  className={`${classes} appearance-none border-0 bg-transparent p-0 text-left`}
                  title={
                    cell.used
                      ? t('shipments.print.labelMarkedUsed', { index: i + 1 })
                      : t('shipments.print.clickToStartFrom', { index: i + 1 })
                  }
                  onClick={onPickStart ? () => onPickStart(i) : undefined}
                >
                  {cell.sim && !cell.used ? (
                    <SimLabelContent lines={makeLines(cell.sim)} gapMm={lineGapMm} />
                  ) : cell.used ? (
                    <div className="flex h-full w-full items-center justify-center">
                      <span
                        className="lp-used-label-text font-medium uppercase tracking-widest"
                        style={{ fontSize: 9 }}
                      >
                        {t('shipments.print.usedLabel')}
                      </span>
                    </div>
                  ) : null}
                </button>
              ) : (
                <div key={i} className={classes}>
                  {cell.sim && !cell.used ? (
                    <SimLabelContent lines={makeLines(cell.sim)} gapMm={lineGapMm} />
                  ) : cell.used ? (
                    <div className="flex h-full w-full items-center justify-center">
                      <span
                        className="lp-used-label-text font-medium uppercase tracking-widest"
                        style={{ fontSize: 9 }}
                      >
                        {t('shipments.print.usedLabel')}
                      </span>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
