import { memo } from 'react';
import type { LabelLineSpec } from './label-formats';

export interface SimLabelContentProps {
  lines: LabelLineSpec[];
  gapMm?: number;
}

function SimLabelContentBase({ lines, gapMm = 0.5 }: SimLabelContentProps) {
  return (
    <div
      className="lp-label"
      style={{ padding: '0.8mm 1.2mm', gap: `${gapMm}mm` }}
    >
      {lines.map((line, i) => (
        <div
          key={i}
          className={line.muted ? 'lp-label__line lp-label__line--muted' : 'lp-label__line'}
          style={{
            fontSize: `${line.fontMm}mm`,
            fontWeight: line.weight,
          }}
        >
          {line.text}
        </div>
      ))}
    </div>
  );
}

export const SimLabelContent = memo(SimLabelContentBase);
