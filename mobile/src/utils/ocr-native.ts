import { NativeModules, Platform } from 'react-native';
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

export interface NativeTextExtractor {
  isSupported?: boolean;
  extractTextFromImage?: (uri: string) => Promise<string[]>;
}

function getNativeTextExtractor(): {
  mod: NativeTextExtractor | null;
  diagnostics: string;
} {
  const offlineMod = NativeModules?.OfflineOcr as
    | NativeTextExtractor
    | undefined;
  if (offlineMod && typeof offlineMod.extractTextFromImage === 'function') {
    return { mod: offlineMod, diagnostics: 'OfflineOcr' };
  }

  const expoMod =
    requireOptionalNativeModule<NativeTextExtractor>('ExpoTextExtractor');
  if (expoMod && typeof expoMod.extractTextFromImage === 'function') {
    return { mod: expoMod, diagnostics: 'ExpoTextExtractor' };
  }

  const diagnostics = `OS=${Platform.OS}, offlineOcr=${Boolean(offlineMod)}, expoTextExtractor=${Boolean(expoMod)}`;
  return { mod: null, diagnostics };
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
    lower.includes('offlineocr') ||
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
  if (
    lower.includes('ocr_file_not_found') ||
    lower.includes('file not found') ||
    lower.includes('enoent')
  ) {
    return new OcrExecutionError('file_missing', message);
  }
  return new OcrExecutionError('unknown', message);
}

export async function runNativeOcr(uri: string): Promise<string[]> {
  const { mod, diagnostics } = getNativeTextExtractor();
  if (!mod || typeof mod.extractTextFromImage !== 'function') {
    throw new OcrExecutionError(
      'missing_native_module',
      `Native OCR unavailable (${diagnostics})`,
    );
  }
  if (mod.isSupported === false) {
    throw new OcrExecutionError(
      'unsupported',
      `On-device OCR is not supported on this device (${diagnostics}).`,
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
