import { memo } from 'react';
import type { LabelLineSpec } from './label-formats';

/**
 * Sadržaj jedne etikete — lista dinamički sastavljenih linija
 * (ICCID / interna IP / javna IP / datum prijema), prema uključenim poljima.
 * Ista komponenta se renderuje i u ekranskom pregledu i u print DOM-u,
 * pa je WYSIWYG dosljedan 1:1.
 */
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
          className="lp-label__line"
          style={{
            fontSize: `${line.fontMm}mm`,
            fontWeight: line.weight,
            color: line.muted ? '#475569' : undefined,
          }}
        >
          {line.text}
        </div>
      ))}
    </div>
  );
}

export const SimLabelContent = memo(SimLabelContentBase);
