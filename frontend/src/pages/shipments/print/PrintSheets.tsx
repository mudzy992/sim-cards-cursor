import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties } from 'react';
import type {
  LabelLineSpec,
  LabelSheetLayout,
  LabelSlot,
  PrintableSimCard,
} from './label-formats';
import { SimLabelContent } from './SimLabelContent';

/**
 * Print-only DOM: renderuje se kroz portal direktno u <body>.
 * Na ekranu je skriven (CSS), a u printu je JEDINI vidljiv sadržaj.
 * Sve dimenzije su u fizičkim mm — browser ih preslikava na papir.
 */
export interface PrintSheetsProps {
  sheets: LabelSlot<PrintableSimCard>[][];
  layout: LabelSheetLayout;
  showOutlines: boolean;
  /** gradi linije etikete (polja/fontovi već izračunati) — dijeli se s pregledom */
  makeLines: (sim: PrintableSimCard) => LabelLineSpec[];
  lineGapMm: number;
}

export function PrintSheets(props: PrintSheetsProps) {
  const { sheets, layout, showOutlines, makeLines, lineGapMm } = props;

  const gridStyle = useMemo<CSSProperties>(
    () => ({
      paddingTop: `${layout.marginTopMm}mm`,
      paddingLeft: `${layout.marginLeftMm}mm`,
      gridTemplateColumns: `repeat(${layout.columns}, ${layout.labelWidthMm}mm)`,
      gridAutoRows: `${layout.labelHeightMm}mm`,
      columnGap: `${layout.gapXMm}mm`,
      rowGap: `${layout.gapYMm}mm`,
    }),
    [layout],
  );

  return createPortal(
    <div className="label-print-root" aria-hidden="true">
      {sheets.map((cells, sheetIndex) => (
        <div className="lp-sheet" key={sheetIndex}>
          <div className="lp-grid" style={gridStyle}>
            {cells.map((cell, cellIndex) => (
              <div
                key={cellIndex}
                className={`lp-cell${showOutlines ? ' lp-cell--outline' : ''}`}
              >
                {cell.sim && !cell.used ? (
                  <SimLabelContent lines={makeLines(cell.sim)} gapMm={lineGapMm} />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>,
    document.body,
  );
}
