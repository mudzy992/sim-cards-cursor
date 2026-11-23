export type OcrErrorKind =
  | 'missing_native_module'
  | 'unsupported'
  | 'model_downloading'
  | 'file_missing'
  | 'unknown';

export class OcrExecutionError extends Error {
  readonly kind: OcrErrorKind;
  readonly detail: string;

  constructor(kind: OcrErrorKind, detail: string) {
    super(detail || kind);
    this.name = 'OcrExecutionError';
    this.kind = kind;
    this.detail = detail;
  }
}

interface TextExtractorApi {
  isSupported?: boolean;
  extractTextFromImage?: (uri: string) => Promise<string[]>;
}

async function loadModule(): Promise<TextExtractorApi | null> {
  try {
    const mod: TextExtractorApi = await import('expo-text-extractor');
    if (typeof mod?.extractTextFromImage !== 'function') {
      return null;
    }
    return mod;
  } catch {
    return null;
  }
}

export function classifyOcrError(error: unknown): OcrExecutionError {
  if (error instanceof OcrExecutionError) {
    return error;
  }
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';
  const lower = message.toLowerCase();

  if (
    lower.includes('cannot find native module') ||
    lower.includes('expotextextractor') ||
    lower.includes('missing_native_module')
  ) {
    return new OcrExecutionError('missing_native_module', message);
  }
  if (
    lower.includes('optional module') ||
    lower.includes('model') && lower.includes('download') ||
    lower.includes('waiting for the text')
  ) {
    return new OcrExecutionError('model_downloading', message);
  }
  if (lower.includes('file not found') || lower.includes('enoent')) {
    return new OcrExecutionError('file_missing', message);
  }
  return new OcrExecutionError('unknown', message);
}

export async function runNativeOcr(uri: string): Promise<string[]> {
  const mod = await loadModule();
  if (!mod || typeof mod.extractTextFromImage !== 'function') {
    throw new OcrExecutionError(
      'missing_native_module',
      'ExpoTextExtractor native module is unavailable in this build.',
    );
  }
  if (mod.isSupported === false) {
    throw new OcrExecutionError(
      'unsupported',
      'On-device OCR is not supported on this device.',
    );
  }
  try {
    const result = await mod.extractTextFromImage(uri);
    return Array.isArray(result) ? result.map(String) : [];
  } catch (error) {
    throw classifyOcrError(error);
  }
}
