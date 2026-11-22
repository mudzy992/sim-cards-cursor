import { isValidIccid, normalizeIccid } from '@sim-tracker/shared';

export type OcrScanMode = 'iccid' | 'meterSerial';

export interface OcrParseOptions {
  mode: OcrScanMode;
  expectedSerialLength?: number | null;
  maxCandidates?: number;
}

const SERIAL_LABEL_REGEX =
  /\b(s\/?n|ser\.?\s*no\.?|serial(?:\s*(?:no|number))?|nr\.?|no\.?|br\.?|broj|id)\b/i;

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

function coerceNumericLikeOcr(raw: string): string {
  const compact = raw.replace(/[\s-]+/g, '');
  if (!compact || compact.length < 10) return '';
  let digitCount = 0;
  for (const ch of compact) {
    if (ch >= '0' && ch <= '9') digitCount += 1;
  }
  if (digitCount / compact.length < 0.75) return '';
  return compact
    .replace(/[OoQqDd]/g, '0')
    .replace(/[Iil|!]/g, '1')
    .replace(/[Zz]/g, '2')
    .replace(/[Ss$]/g, '5')
    .replace(/[Gb]/g, '6')
    .replace(/[B]/g, '8');
}

function extractIccidCandidates(lines: string[], maxCandidates: number): string[] {
  const sources: Array<{ text: string; isMerged: boolean }> = [];
  for (let i = 0; i < lines.length; i += 1) {
    const current = lines[i]?.trim() ?? '';
    if (!current) continue;
    sources.push({ text: current, isMerged: false });
    const next = lines[i + 1]?.trim();
    if (next) {
      sources.push({ text: `${current}${next}`, isMerged: true });
      sources.push({ text: `${current} ${next}`, isMerged: true });
    }
  }

  const scored = new Map<string, number>();

  const register = (candidate: string, baseBonus: number) => {
    const normalized = normalizeIccid(candidate);
    if (!isValidIccid(normalized)) return;
    let score = baseBonus;
    if (normalized.startsWith('89')) score += 60;
    if (normalized.length === 19 || normalized.length === 20) score += 45;
    else if (normalized.length >= 18 && normalized.length <= 22) score += 20;
    else if (normalized.length < 15) score -= 25;
    if (isValidLuhn(normalized)) score += 40;
    const prev = scored.get(normalized);
    if (prev === undefined || score > prev) {
      scored.set(normalized, score);
    }
  };

  for (const src of sources) {
    const cleanMatches = src.text.match(/\d[\d\s-]{9,32}\d/g) ?? [];
    for (const m of cleanMatches) {
      register(m, src.isMerged ? 25 : 40);
    }

    const fuzzyMatches = src.text.match(/[0-9A-Za-z|!$]{14,32}/g) ?? [];
    for (const fm of fuzzyMatches) {
      const coerced = coerceNumericLikeOcr(fm);
      if (coerced) {
        register(coerced, src.isMerged ? 10 : 20);
      }
    }

    const entireLineCoerced = coerceNumericLikeOcr(src.text);
    if (entireLineCoerced) {
      register(entireLineCoerced, src.isMerged ? 10 : 18);
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

  const register = (rawToken: string, hasSerialLabel: boolean, compactBonus = 0) => {
    const cleaned = rawToken.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');
    if (cleaned.length < 3 || cleaned.length > 64) return;
    if (!/\d/.test(cleaned)) return;
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
    let score = compactBonus;

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
    }

    // Spaced digit groups on meter faceplates (e.g. "1234 5678" -> "12345678")
    const strippedGroups = line.replace(
      /(?<=\d)\s+(?=\d)/g,
      '',
    );
    if (strippedGroups !== line) {
      const mergedTokens = strippedGroups.split(/[\s,;:=()[\]]+/).filter(Boolean);
      for (const token of mergedTokens) {
        if (/^\d{4,}$/.test(token)) {
          register(token, lineHasLabel, hasExpectedLength && token.length === expectedSerialLength ? 10 : -5);
        }
      }
    }
  }

  return Array.from(scored.entries())
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, maxCandidates)
    .map(([value]) => value);
}

export function extractOcrCandidates(
  lines: string[],
  options: OcrParseOptions,
): string[] {
  const maxCandidates = options.maxCandidates ?? 5;
  const normalizedLines = lines
    .flatMap((line) => line.split(/\r?\n/))
    .map((line) => line.trim())
    .filter(Boolean);

  if (normalizedLines.length === 0) return [];

  if (options.mode === 'iccid') {
    return extractIccidCandidates(normalizedLines, maxCandidates);
  }

  return extractMeterSerialCandidates(
    normalizedLines,
    options.expectedSerialLength,
    maxCandidates,
  );
}
