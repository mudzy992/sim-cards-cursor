import { analyzeOcrText, extractOcrCandidates } from '@/utils/ocr-parser';

describe('extractOcrCandidates', () => {
  it('extracts and prioritizes valid SIM ICCID across spaced or split lines', () => {
    const lines = [
      'BH TELECOM',
      '8938 7020 0000',
      '1234 5672',
      'PIN 1234',
    ];
    const result = extractOcrCandidates(lines, { mode: 'iccid' });
    expect(result[0]).toBe('89387020000012345672');
  });

  it('extracts SIM ICCID split across 4 short plastic rows and optional trailing F', () => {
    const lines = ['89387', '02000', '00123', '4567F'];
    const result = extractOcrCandidates(lines, { mode: 'iccid' });
    expect(result[0]).toBe('8938702000001234567');
  });

  it('recovers SIM ICCID when OCR confuses O/I/S with digits across multiple rows', () => {
    const lines = ['ICCID: 89387O2000', 'OOI2345672'];
    const result = extractOcrCandidates(lines, { mode: 'iccid' });
    expect(result).toContain('89387020000012345672');
  });

  it('uses expectedSerialLength and serial labels to rank meter serial above nameplate noise', () => {
    const lines = [
      'Landis+Gyr E650',
      '3x230/400V 50Hz',
      '10(60)A Class B',
      '2024 IP54',
      'S/N: 48201944',
      '1000 imp/kWh',
    ];
    const result = extractOcrCandidates(lines, {
      mode: 'meterSerial',
      expectedSerialLength: 8,
    });
    expect(result[0]).toBe('48201944');
    expect(result).not.toContain('2024');
    expect(result).not.toContain('50Hz');
  });

  it('handles spaced serial numbers and attached SN prefixes', () => {
    const lines = ['SN:00 4820 1944', '230V 50Hz'];
    const result = extractOcrCandidates(lines, {
      mode: 'meterSerial',
      expectedSerialLength: 10,
    });
    expect(result[0]).toBe('0048201944');
  });

  it('prefers exact expectedSerialLength match over other numeric strings', () => {
    const lines = [
      'Type AMM 3.0',
      'Batch 123456',
      '9012345678',
      'IEC 62053-21',
    ];
    const result = extractOcrCandidates(lines, {
      mode: 'meterSerial',
      expectedSerialLength: 10,
    });
    expect(result[0]).toBe('9012345678');
  });

  it('falls back cleanly when expectedSerialLength is omitted', () => {
    const lines = ['MID M24', 'Ser.No. LGZ99887766', '230V 50Hz'];
    const result = extractOcrCandidates(lines, { mode: 'meterSerial' });
    expect(result[0]).toBe('LGZ99887766');
  });

  it('returns rawPreview alongside empty candidates when no numeric match exists', () => {
    const analysis = analyzeOcrText(['Landis+Gyr', 'Made in Switzerland'], {
      mode: 'iccid',
    });
    expect(analysis.candidates).toEqual([]);
    expect(analysis.rawPreview).toEqual(['Landis+Gyr', 'Made in Switzerland']);
  });
});
