import { requireOptionalNativeModule } from 'expo-modules-core';

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

interface ExpoTextExtractorNative {
  isSupported?: boolean;
  extractTextFromImage?: (uri: string) => Promise<string[]>;
}

function getNativeTextExtractor(): ExpoTextExtractorNative | null {
  const nativeMod =
    requireOptionalNativeModule<ExpoTextExtractorNative>('ExpoTextExtractor');
  if (nativeMod && typeof nativeMod.extractTextFromImage === 'function') {
    return nativeMod;
  }
  return null;
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
    (lower.includes('model') && lower.includes('download')) ||
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
  const mod = getNativeTextExtractor();
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
    const processedUri = uri.startsWith('file://')
      ? uri.slice('file://'.length)
      : uri;
    const result = await mod.extractTextFromImage(processedUri);
    return Array.isArray(result) ? result.map(String) : [];
  } catch (error) {
    throw classifyOcrError(error);
  }
}
