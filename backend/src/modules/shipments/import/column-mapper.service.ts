export type ImportDomainKey =
  | 'iccid'
  | 'ipAddress'
  | 'publicIpAddress'
  | 'phoneNumber'
  | 'apn';

const CANDIDATE_HEADERS: Record<ImportDomainKey, string[]> = {
  iccid: ['iccid', 'barcode', 'sim', 'sim_iccid'],
  ipAddress: [
    'epbih ip',
    'ep bih ip',
    'lokalna ip',
    'private ip',
    'privatna ip',
    'lan ip',
    'ip address',
    'ip',
  ],
  publicIpAddress: [
    'ip adresa',
    'javna ip',
    'javna ip adresa',
    'public ip',
    'wan ip',
    'public_ip',
  ],
  phoneNumber: ['msisdn', 'phone', 'phone number', 'broj telefona', 'broj'],
  apn: ['apn'],
};

function normalize(value: string): string {
  return value
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

export class ColumnMapperService {
  suggest(headers: string[]): Record<ImportDomainKey, string | null> {
    const normalizedToOriginal = new Map<string, string>();
    for (const header of headers) {
      normalizedToOriginal.set(normalize(header), header);
    }

    const mapping: Record<ImportDomainKey, string | null> = {
      iccid: null,
      ipAddress: null,
      publicIpAddress: null,
      phoneNumber: null,
      apn: null,
    };

    (Object.keys(mapping) as ImportDomainKey[]).forEach((key) => {
      const candidates = CANDIDATE_HEADERS[key];
      const found = candidates.find((candidate) => normalizedToOriginal.has(normalize(candidate)));
      mapping[key] = found ? normalizedToOriginal.get(normalize(found)) ?? null : null;
    });

    return mapping;
  }

  merge(
    suggested: Record<ImportDomainKey, string | null>,
    provided?: Partial<Record<ImportDomainKey, string>>,
  ): Record<ImportDomainKey, string | null> {
    if (!provided) {
      return suggested;
    }

    return {
      iccid: provided.iccid ?? suggested.iccid,
      ipAddress: provided.ipAddress ?? suggested.ipAddress,
      publicIpAddress: provided.publicIpAddress ?? suggested.publicIpAddress,
      phoneNumber: provided.phoneNumber ?? suggested.phoneNumber,
      apn: provided.apn ?? suggested.apn,
    };
  }
}
