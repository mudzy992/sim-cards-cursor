import { describe, expect, it } from 'vitest';
import { normalizePreviewRow } from './import.types';

describe('normalizePreviewRow duplicate classification', () => {
  it('classifies in-file and DB duplicates across ICCID, IP, public IP, and phone number', () => {
    const row = normalizePreviewRow({
      rowNumber: 5,
      data: {
        iccid: '89387000000000000001',
        ipAddress: '10.10.0.1',
        publicIpAddress: '31.47.10.1',
        phoneNumber: '061111222',
        apn: null,
      },
      errors: [
        'Duplikat unutar fajla — ista interna IP adresa (10.10.0.1) je već u redu 2',
        'Broj telefona (061111222) već postoji u isporuci „Test“ (prijem 01.01.2026)',
      ],
      warning: [],
      duplicateInFileOfRow: 2,
      duplicateOf: {
        shipmentId: 'ship-1',
        shipmentName: 'Test',
        receivedDate: '2026-01-01T00:00:00.000Z',
      },
    });

    expect(row.importable).toBe(false);
    expect(row.issues.map((i) => i.code)).toEqual([
      'DUPLICATE_IN_FILE',
      'DUPLICATE_IN_DATABASE',
    ]);
  });
});
