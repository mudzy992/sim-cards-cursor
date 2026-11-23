import { isValidIccid, normalizeIccid } from '@sim-tracker/shared';

export type OcrScanMode = 'iccid' | 'meterSerial';

export interface OcrParseOptions {
  mode: OcrScanMode;
  expectedSerialLength?: number | null;
  maxCandidates?: number;
}

export interface OcrAnalysisResult {
  candidates: string[];
  rawPreview: string[];
}

const SERIAL_LABEL_REGEX =
  /\b(s\/?n|ser\.?\s*no\.?|serial(?:\s*(?:no|number))?|nr\.?|no\.?|br\.?|broj|id)\b/i;

const SERIAL_PREFIX_STRIP_REGEX =
  /^(?:s\/?n|ser\.?\s*no\.?|serial|nr|no|br|id)[:.\-#]*/i;

const NOISE_TOKEN_REGEX =
  /^(?:\d+(?:[.,]\d+)?\s*(?:v|a|hz|kwh|kvarh|kvah|va|w|kw|mw|imp\/kwh|imp)|ip\d{2}|class\s*[a-c0-9]+|iec[\s\-0-9]*|en[\s\-0-9]*|mid|ce|m\d{2})$/i;

const YEAR_ONLY_REGEX = /^(?:19[89]\d|20[0-3]\d)$/;
const DATE_LIKE_REGEX = /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/;
const VERSION_OR_IP_REGEX = /^\d+\.\d+(?:\.\d+)+$/;

function isValidLuhn(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let n = Number.parseInt(digits[i] ?? '0', 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

function coerceDigitsFromToken(raw: string, minDigitRatio = 0.65): string {
  const compact = raw.replace(/[\s\-._/]+/g, '');
  if (!compact) return '';
  // Strip GSM trailing 'F' pad if preceded by 18-20 digit-like chars
  const trimmedPad =
    compact.length >= 19 && compact.length <= 22 && /[fF]$/.test(compact)
      ? compact.slice(0, -1)
      : compact;

  let digitCount = 0;
  for (const ch of trimmedPad) {
    if (ch >= '0' && ch <= '9') digitCount += 1;
  }
  if (digitCount / trimmedPad.length < minDigitRatio) return '';

  return trimmedPad
    .replace(/[OoQqDd]/g, '0')
    .replace(/[Iil|!]/g, '1')
    .replace(/[Zz]/g, '2')
    .replace(/[Aa]/g, '4')
    .replace(/[Ss$]/g, '5')
    .replace(/[Gb]/g, '6')
    .replace(/[T]/g, '7')
    .replace(/[B]/g, '8');
}

function extractIccidCandidates(
  rawBlocks: string[],
  lines: string[],
  maxCandidates: number,
): string[] {
  const sources: Array<{ text: string; span: number }> = [];

  // Full multi-line text blocks as returned by ML Kit (preserves block grouping)
  for (const block of rawBlocks) {
    const collapsed = block.replace(/\s+/g, ' ').trim();
    if (collapsed) {
      sources.push({ text: collapsed, span: 1 });
      sources.push({ text: block.replace(/\s+/g, ''), span: 2 });
    }
  }

  // Sliding windows of 1..5 consecutive lines (SIM plastic often prints ICCID across 3-4 rows)
  for (let i = 0; i < lines.length; i += 1) {
    for (let window = 1; window <= 5 && i + window <= lines.length; window += 1) {
      const slice = lines.slice(i, i + window);
      sources.push({ text: slice.join(' '), span: window });
      if (window > 1) {
        sources.push({ text: slice.join(''), span: window });
      }
    }
  }

  const scored = new Map<string, number>();

  const register = (candidate: string, baseBonus: number) => {
    const cleaned = candidate.replace(/[\s\-._/]+/g, '');
    const normalized = normalizeIccid(cleaned);
    if (!isValidIccid(normalized)) return;

    let score = baseBonus;
    if (normalized.startsWith('89')) score += 70;
    if (normalized.length === 19 || normalized.length === 20) score += 55;
    else if (normalized.length >= 18 && normalized.length <= 22) score += 30;
    else if (normalized.length >= 15 && normalized.length <= 17) score += 10;
    else if (normalized.length < 15) score -= 20;

    if (isValidLuhn(normalized)) score += 40;

    const prev = scored.get(normalized);
    if (prev === undefined || score > prev) {
      scored.set(normalized, score);
    }
  };

  for (const src of sources) {
    const spanBonus = src.span === 1 ? 40 : Math.max(15, 36 - src.span * 4);

    // 1. Clean digit runs (allowing spaces/dashes between digit groups)
    const cleanMatches = src.text.match(/\d[\d\s\-._]{8,34}\d/g) ?? [];
    for (const m of cleanMatches) {
      register(m, spanBonus);
    }

    // 2. Digit runs followed by optional GSM 'F' padding
    const gsmMatches = src.text.match(/\d[\d\s-]{16,28}[fF]\b/g) ?? [];
    for (const gm of gsmMatches) {
      register(gm.slice(0, -1), spanBonus - 5);
    }

    // 3. Fuzzy numeric-like strings where small print caused O/I/S/B confusion
    const fuzzyMatches = src.text.match(/[0-9A-Za-z|!$\s-]{12,38}/g) ?? [];
    for (const fm of fuzzyMatches) {
      const coerced = coerceDigitsFromToken(fm, 0.7);
      if (coerced) {
        register(coerced, spanBonus - 15);
      }
    }

    // 4. Whole line/window coercion when mostly numeric
    const wholeCoerced = coerceDigitsFromToken(src.text, 0.72);
    if (wholeCoerced) {
      register(wholeCoerced, spanBonus - 12);
    }
  }

  return Array.from(scored.entries())
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, maxCandidates)
    .map(([value]) => value);
}

function extractMeterSerialCandidates(
  lines: string[],
  expectedSerialLength: number | null | undefined,
  maxCandidates: number,
): string[] {
  const hasExpectedLength =
    typeof expectedSerialLength === 'number' &&
    Number.isInteger(expectedSerialLength) &&
    expectedSerialLength > 0;

  const scored = new Map<string, number>();
  const fallbackTokens = new Map<string, number>();

  const register = (
    rawToken: string,
    hasSerialLabel: boolean,
    bonus = 0,
  ) => {
    const cleaned = rawToken.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');
    if (cleaned.length < 3 || cleaned.length > 64) return;
    if (!/\d/.test(cleaned)) return;

    const digitCount = (cleaned.match(/\d/g) ?? []).length;
    if (digitCount >= 2) {
      const fbScore =
        (hasSerialLabel ? 40 : 0) +
        digitCount * 2 +
        (hasExpectedLength && cleaned.length === expectedSerialLength ? 80 : 0);
      const prevFb = fallbackTokens.get(cleaned);
      if (prevFb === undefined || fbScore > prevFb) {
        fallbackTokens.set(cleaned, fbScore);
      }
    }

    if (NOISE_TOKEN_REGEX.test(cleaned)) return;
    if (DATE_LIKE_REGEX.test(cleaned)) return;
    if (VERSION_OR_IP_REGEX.test(cleaned)) return;
    if (
      YEAR_ONLY_REGEX.test(cleaned) &&
      (!hasExpectedLength || expectedSerialLength !== 4)
    ) {
      return;
    }

    const isNumericOnly = /^\d+$/.test(cleaned);
    let score = bonus;

    if (hasSerialLabel) score += 60;
    if (isNumericOnly) score += 35;

    if (hasExpectedLength) {
      const diff = Math.abs(cleaned.length - expectedSerialLength);
      if (diff === 0) {
        score += 120;
      } else if (diff === 1) {
        score += 25;
      } else if (diff <= 2) {
        score += 5;
      } else {
        score -= 40;
      }
    } else {
      if (cleaned.length >= 8 && cleaned.length <= 14) score += 45;
      else if (cleaned.length >= 6 && cleaned.length <= 18) score += 25;
      else if (cleaned.length <= 4) score -= 20;
    }

    const prev = scored.get(cleaned);
    if (prev === undefined || score > prev) {
      scored.set(cleaned, score);
    }
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]?.trim() ?? '';
    if (!line) continue;

    const prevLine = lines[i - 1]?.trim() ?? '';
    const lineHasLabel =
      SERIAL_LABEL_REGEX.test(line) || SERIAL_LABEL_REGEX.test(prevLine);

    const rawTokens = line.split(/[\s,;:=()[\]]+/).filter(Boolean);
    for (const token of rawTokens) {
      if (/^\d+(?:[.,]\d+)?(?:v|a|hz|kwh|kvarh|kw|w)$/i.test(token)) continue;
      register(token, lineHasLabel, 0);

      const withoutLabelPrefix = token.replace(SERIAL_PREFIX_STRIP_REGEX, '');
      if (withoutLabelPrefix && withoutLabelPrefix !== token) {
        register(withoutLabelPrefix, true, 15);
      }

      const coerced = coerceDigitsFromToken(withoutLabelPrefix || token, 0.7);
      if (coerced && coerced !== token && /^\d{4,}$/.test(coerced)) {
        register(coerced, lineHasLabel, -8);
      }
    }

    // Spaced digit groups on meter faceplates (e.g. "00 4820 1944" -> "0048201944")
    const strippedGroups = line.replace(/(?<=\d)\s+(?=\d)/g, '');
    if (strippedGroups !== line) {
      const mergedTokens = strippedGroups
        .split(/[\s,;:=()[\]]+/)
        .filter(Boolean);
      for (const token of mergedTokens) {
        if (/^\d{4,}$/.test(token)) {
          register(
            token,
            lineHasLabel,
            hasExpectedLength && token.length === expectedSerialLength ? 12 : -4,
          );
        }
      }
    }
  }

  const primary = Array.from(scored.entries())
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, maxCandidates)
    .map(([value]) => value);

  if (primary.length > 0) {
    return primary;
  }

  return Array.from(fallbackTokens.entries())
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, maxCandidates)
    .map(([value]) => value);
}

export function analyzeOcrText(
  lines: string[],
  options: OcrParseOptions,
): OcrAnalysisResult {
  const maxCandidates = options.maxCandidates ?? 5;
  const rawBlocks = lines.map((line) => line.trim()).filter(Boolean);
  const normalizedLines = rawBlocks
    .flatMap((line) => line.split(/\r?\n/))
    .map((line) => line.trim())
    .filter(Boolean);

  if (normalizedLines.length === 0) {
    return { candidates: [], rawPreview: [] };
  }

  const candidates =
    options.mode === 'iccid'
      ? extractIccidCandidates(rawBlocks, normalizedLines, maxCandidates)
      : extractMeterSerialCandidates(
          normalizedLines,
          options.expectedSerialLength,
          maxCandidates,
        );

  return {
    candidates,
    rawPreview: normalizedLines.slice(0, 4),
  };
}

export function extractOcrCandidates(
  lines: string[],
  options: OcrParseOptions,
): string[] {
  return analyzeOcrText(lines, options).candidates;
}
