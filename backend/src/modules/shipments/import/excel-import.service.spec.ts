import { ExcelImportService, ExistingSimFieldsMaps, normalizePhoneNumber } from './excel-import.service';

describe('ExcelImportService', () => {
  const service = new ExcelImportService();

  const mapping = {
    iccid: 'ICCID',
    ipAddress: 'IP',
    publicIpAddress: 'PublicIP',
    phoneNumber: 'Phone',
    apn: 'APN',
  };

  function emptyExisting(): ExistingSimFieldsMaps {
    return {
      byIccid: new Map(),
      byIpAddress: new Map(),
      byPublicIpAddress: new Map(),
      byPhoneNumber: new Map(),
    };
  }

  it('detects in-file duplicates across iccid, ipAddress, publicIpAddress, and normalized phoneNumber', () => {
    const parsed = {
      headers: ['ICCID', 'IP', 'PublicIP', 'Phone', 'APN'],
      rows: [
        { ICCID: '89387000000000000001', IP: '10.10.0.1', PublicIP: '31.47.10.1', Phone: '061 111 222', APN: 'apn1' },
        { ICCID: '89387000000000000001', IP: '10.10.0.2', PublicIP: '31.47.10.2', Phone: '061 111 223', APN: 'apn1' },
        { ICCID: '89387000000000000003', IP: '10.10.0.1', PublicIP: '31.47.10.3', Phone: '061 111 224', APN: 'apn1' },
        { ICCID: '89387000000000000004', IP: '10.10.0.4', PublicIP: '31.47.10.1', Phone: '061 111 225', APN: 'apn1' },
        { ICCID: '89387000000000000005', IP: '10.10.0.5', PublicIP: '31.47.10.5', Phone: '061-111-222', APN: 'apn1' },
      ],
    };

    const result = service.validate(parsed, mapping, emptyExisting());

    expect(result.summary.totalRows).toBe(5);
    expect(result.summary.validRows).toBe(1);
    expect(result.summary.invalidRows).toBe(4);
    expect(result.summary.duplicatesInFile).toBe(4);
    expect(result.rows[0].importable).toBe(true);
    expect(result.rows[1].errors[0]).toContain('isti ICCID');
    expect(result.rows[2].errors[0]).toContain('ista interna IP adresa');
    expect(result.rows[3].errors[0]).toContain('ista javna IP adresa');
    expect(result.rows[4].errors[0]).toContain('isti broj telefona');
    expect(result.rows[4].duplicateInFileOfRow).toBe(2);
  });

  it('detects database duplicates across iccid, ipAddress, publicIpAddress, and phoneNumber', () => {
    const existing = emptyExisting();
    const hitInfo = {
      shipmentId: 'ship-1',
      shipmentName: 'Isporuka Jan',
      receivedDate: new Date('2026-01-15T00:00:00Z'),
    };
    existing.byIccid.set('89387000000000000010', hitInfo);
    existing.byIpAddress.set('10.20.0.2', hitInfo);
    existing.byPublicIpAddress.set('31.47.20.3', hitInfo);
    existing.byPhoneNumber.set(normalizePhoneNumber('062 999 888'), hitInfo);

    const parsed = {
      headers: ['ICCID', 'IP', 'PublicIP', 'Phone', 'APN'],
      rows: [
        { ICCID: '89387000000000000010', IP: '10.20.0.1', PublicIP: '31.47.20.1', Phone: '062 000 001', APN: 'apn1' },
        { ICCID: '89387000000000000011', IP: '10.20.0.2', PublicIP: '31.47.20.2', Phone: '062 000 002', APN: 'apn1' },
        { ICCID: '89387000000000000012', IP: '10.20.0.3', PublicIP: '31.47.20.3', Phone: '062 000 003', APN: 'apn1' },
        { ICCID: '89387000000000000013', IP: '10.20.0.4', PublicIP: '31.47.20.4', Phone: '062999888', APN: 'apn1' },
        { ICCID: '89387000000000000014', IP: '10.20.0.5', PublicIP: '', Phone: '', APN: 'apn1' },
      ],
    };

    const result = service.validate(parsed, mapping, existing);

    expect(result.summary.validRows).toBe(1);
    expect(result.summary.duplicatesInDatabase).toBe(4);
    expect(result.rows[0].errors[0]).toContain('ICCID već postoji');
    expect(result.rows[1].errors[0]).toContain('Interna IP adresa');
    expect(result.rows[2].errors[0]).toContain('Javna IP adresa');
    expect(result.rows[3].errors[0]).toContain('Broj telefona');
    expect(result.rows[4].importable).toBe(true);
  });
});
