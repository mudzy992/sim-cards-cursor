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
  });

  it('strips file:// prefix and returns recognized lines from ExpoTextExtractor native module', async () => {
    const spy = jest
      .spyOn(textExtractor, 'extractTextFromImage')
      .mockResolvedValueOnce(['S/N: 48201944', '230V 50Hz']);

    const lines = await runNativeOcr('file:///tmp/meter.jpg');
    expect(spy).toHaveBeenCalledWith('/tmp/meter.jpg');
    expect(lines).toEqual(['S/N: 48201944', '230V 50Hz']);
  });

  it('throws missing_native_module when ExpoTextExtractor is absent from binary', async () => {
    const reqSpy = jest
      .spyOn(expoMock, 'requireOptionalNativeModule')
      .mockReturnValueOnce(null);

    await expect(runNativeOcr('file:///tmp/meter.jpg')).rejects.toMatchObject({
      kind: 'missing_native_module',
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

    const unknown = classifyOcrError(new Error('Camera busy'));
    expect(unknown).toBeInstanceOf(OcrExecutionError);
    expect(unknown.kind).toBe('unknown');
    expect(unknown.detail).toBe('Camera busy');
  });
});
