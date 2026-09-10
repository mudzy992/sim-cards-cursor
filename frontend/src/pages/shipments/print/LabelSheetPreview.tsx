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

/**
 * Ekranski pregled jednog A4 lista — geometrijski identičan printu,
 * samo skaliran u px. Klik na etiketu na PRVOM listu postavlja početnu
 * poziciju printa (sve ispred nje se tretiraju kao već iskorištene).
 * U zaglavlju lista prikazuje i brojač popunjenosti (npr. 80/80).
 */
export interface LabelSheetPreviewProps {
  cells: LabelSlot<PrintableSimCard>[];
  layout: LabelSheetLayout;
  scale: number;
  sheetNumber: number;
  totalSheets: number;
  /** true samo za prvi list — omogućava klik za startnu poziciju */
  interactive: boolean;
  showGuides: boolean;
  /** gradi linije etikete (ista funkcija se koristi i za print) */
  makeLines: (sim: PrintableSimCard) => LabelLineSpec[];
  lineGapMm: number;
  /** poziva se klikom na ćeliju prvog lista (index ćelije u mreži) */
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
      <div className="mb-2 flex items-center justify-between px-1 text-xs text-slate-500">
        <span className="font-medium">
          {t('shipments.print.sheetOf', { sheet: sheetNumber, total: totalSheets })}
          <span
            className={`ms-2 rounded px-1.5 py-0.5 text-[11px] font-semibold ${
              filled === cells.length
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-slate-100 text-slate-500'
            }`}
            title={t('shipments.print.filledLabelsOnSheet')}
          >
            {filled}/{cells.length}
          </span>
        </span>
        <span>
          A4 · {formatMm(layout.labelWidthMm)} × {formatMm(layout.labelHeightMm)} mm
        </span>
      </div>

      {/* vanjski okvir fiksne (skalirane) veličine */}
      <div
        style={{ width: sheetW * scale, height: sheetH * scale }}
        className="relative overflow-hidden"
      >
        {/* papir u punoj px veličini, skaliran transformom */}
        <div
          style={{
            width: sheetW,
            height: sheetH,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
          className="absolute left-0 top-0 bg-white shadow-[0_10px_40px_-12px_rgba(15,23,42,0.35)] ring-1 ring-slate-300/70"
        >
          <div className="grid" style={gridStyle}>
            {cells.map((cell, i) => {
              const classes = [
                'lp-preview-cell',
                interactive ? 'lp-preview-cell--clickable' : '',
                cell.used ? 'lp-preview-cell--used' : '',
              ]
                .filter(Boolean)
                .join(' ');

              return (
                <div
                  key={i}
                  className={classes}
                  style={{
                    boxShadow: showGuides
                      ? 'inset 0 0 0 0.6px rgba(148, 163, 184, 0.55)'
                      : undefined,
                  }}
                  title={
                    interactive
                      ? cell.used
                        ? t('shipments.print.labelMarkedUsed', { index: i + 1 })
                        : t('shipments.print.clickToStartFrom', { index: i + 1 })
                      : undefined
                  }
                  onClick={interactive && onPickStart ? () => onPickStart(i) : undefined}
                >
                  {cell.sim && !cell.used ? (
                    <SimLabelContent lines={makeLines(cell.sim)} gapMm={lineGapMm} />
                  ) : cell.used ? (
                    <div className="flex h-full w-full items-center justify-center">
                      <span
                        className="font-medium uppercase tracking-widest text-slate-400"
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
