export const IPV4_REGEX =
  /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

export const ICCID_REGEX = /^\d{10,30}$/;

/**
 * Normalizes an email address for storage and case-insensitive lookup.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Normalizes an ICCID value by stripping all whitespace.
 */
export function normalizeIccid(value: string): string {
  return value.replace(/\s+/g, '');
}

/**
 * Normalizes a phone number by stripping spaces, dashes, parentheses, and slashes.
 */
export function normalizePhoneNumber(value: string): string {
  return value.replace(/[\s\-()/]+/g, '').trim();
}

export function isValidIpv4(value: string): boolean {
  return IPV4_REGEX.test(value.trim());
}

export function isValidIccid(value: string): boolean {
  return ICCID_REGEX.test(normalizeIccid(value));
}

export type MeterSerialLengthCheck = {
  valid: boolean;
  actualLength: number;
  expectedLength: number | null;
};

/**
 * Validates a meter serial number against an optional expected character length
 * configured on its MeterTypeDefinition.
 */
export function validateMeterSerialLength(
  serialNumber: string,
  expectedLength?: number | null,
): MeterSerialLengthCheck {
  const trimmed = serialNumber.trim();
  const actualLength = trimmed.length;
  if (
    expectedLength === undefined ||
    expectedLength === null ||
    !Number.isInteger(expectedLength) ||
    expectedLength <= 0
  ) {
    return { valid: actualLength > 0, actualLength, expectedLength: null };
  }
  return {
    valid: actualLength === expectedLength,
    actualLength,
    expectedLength,
  };
}
