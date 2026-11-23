import { NativeModules } from 'react-native';
import * as expoMock from 'expo-modules-core';
import * as textExtractor from 'expo-text-extractor';
import {
  classifyOcrError,
  OcrExecutionError,
  runNativeOcr,
} from '@/utils/ocr-native';

describe('ocr-native', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete NativeModules.OfflineOcr;
  });

  it('prefers bundled OfflineOcr native module when available and strips file://', async () => {
    const extractMock = jest.fn(async () => ['89387012345678901234']);
    NativeModules.OfflineOcr = {
      isSupported: true,
      extractTextFromImage: extractMock,
    };

    const lines = await runNativeOcr('file:///tmp/sim.jpg');
    expect(extractMock).toHaveBeenCalledWith('/tmp/sim.jpg');
    expect(lines).toEqual(['89387012345678901234']);
  });

  it('falls back to ExpoTextExtractor when OfflineOcr is absent', async () => {
    const spy = jest
      .spyOn(textExtractor, 'extractTextFromImage')
      .mockResolvedValueOnce(['S/N: 48201944', '230V 50Hz']);

    const lines = await runNativeOcr('file:///tmp/meter.jpg');
    expect(spy).toHaveBeenCalledWith('/tmp/meter.jpg');
    expect(lines).toEqual(['S/N: 48201944', '230V 50Hz']);
  });

  it('preserves content:// URIs without stripping scheme', async () => {
    const extractMock = jest.fn(async () => ['S/N 12345678']);
    NativeModules.OfflineOcr = {
      isSupported: true,
      extractTextFromImage: extractMock,
    };

    const lines = await runNativeOcr('content://media/external/images/media/42');
    expect(extractMock).toHaveBeenCalledWith(
      'content://media/external/images/media/42',
    );
    expect(lines).toEqual(['S/N 12345678']);
  });

  it('throws missing_native_module with diagnostics when neither module is present', async () => {
    const reqSpy = jest
      .spyOn(expoMock, 'requireOptionalNativeModule')
      .mockReturnValueOnce(null);

    await expect(runNativeOcr('file:///tmp/meter.jpg')).rejects.toMatchObject({
      kind: 'missing_native_module',
      detail: expect.stringContaining('offlineOcr=false'),
    });
    expect(reqSpy).toHaveBeenCalledWith('ExpoTextExtractor');
  });

  it('classifies native module, ML Kit model download, and file errors cleanly', () => {
    expect(
      classifyOcrError(new Error("Cannot find native module 'ExpoTextExtractor'"))
        .kind,
    ).toBe('missing_native_module');

    expect(
      classifyOcrError(
        new Error('Waiting for the text optional module to be downloaded.'),
      ).kind,
    ).toBe('model_downloading');

    expect(
      classifyOcrError(new Error('File not found: /tmp/missing.jpg')).kind,
    ).toBe('file_missing');

    expect(
      classifyOcrError(new Error('OCR_FILE_NOT_FOUND: /tmp/missing.jpg')).kind,
    ).toBe('file_missing');

    const unknown = classifyOcrError(new Error('Camera busy'));
    expect(unknown).toBeInstanceOf(OcrExecutionError);
    expect(unknown.kind).toBe('unknown');
    expect(unknown.detail).toBe('Camera busy');
  });
});
