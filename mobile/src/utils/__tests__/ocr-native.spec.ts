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

  it('returns recognized lines from expo-text-extractor', async () => {
    const spy = jest
      .spyOn(textExtractor, 'extractTextFromImage')
      .mockResolvedValueOnce(['S/N: 48201944', '230V 50Hz']);

    const lines = await runNativeOcr('file:///tmp/meter.jpg');
    expect(spy).toHaveBeenCalledWith('file:///tmp/meter.jpg');
    expect(lines).toEqual(['S/N: 48201944', '230V 50Hz']);
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
