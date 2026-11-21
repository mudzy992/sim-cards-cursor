import { describe, expect, it, beforeEach } from 'vitest';
import type { AxiosError } from 'axios';
import { getApiErrorMessage } from './error.utils';
import { LANGUAGE_STORAGE_KEY } from '@/i18n/types';

function makeAxiosError(status?: number, data?: unknown): AxiosError {
  return {
    isAxiosError: true,
    response: status
      ? ({ status, data } as AxiosError['response'])
      : undefined,
  } as AxiosError;
}

describe('getApiErrorMessage', () => {
  beforeEach(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
  });

  it('extracts string message from API response', () => {
    const err = makeAxiosError(400, { message: 'Invalid serial number' });
    expect(getApiErrorMessage(err, 'Fallback')).toBe('Invalid serial number');
  });

  it('extracts first non-empty string when API returns message array', () => {
    const err = makeAxiosError(400, { message: ['', 'ICCID must be 19 digits', 'Other'] });
    expect(getApiErrorMessage(err, 'Fallback')).toBe('ICCID must be 19 digits');
  });

  it('translates known backend errorCode into active UI language', () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'bs');
    const errBs = makeAxiosError(401, {
      errorCode: 'AUTH_INVALID_CREDENTIALS',
      message: 'Invalid credentials',
    });
    expect(getApiErrorMessage(errBs, 'Fallback')).toContain('Neispravni');

    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
    const errEn = makeAxiosError(409, {
      errorCode: 'PRISMA_UNIQUE_CONFLICT',
      message: 'Record with this unique value already exists',
    });
    expect(getApiErrorMessage(errEn, 'Fallback')).toContain('already exists');

    const errSimEn = makeAxiosError(409, {
      errorCode: 'SIM_DUPLICATE_ICCID',
      message: 'SIM kartica sa ovim ICCID-om već postoji u bazi.',
    });
    expect(getApiErrorMessage(errSimEn, 'Fallback')).toBe('A SIM card with this ICCID already exists.');
  });

  it('returns localized network error when no response', () => {
    const err = makeAxiosError(undefined);
    expect(getApiErrorMessage(err, 'Fallback')).toContain('internet connection');
  });

  it('returns localized session expired error on 401 without body message', () => {
    const err = makeAxiosError(401, {});
    expect(getApiErrorMessage(err, 'Fallback')).toContain('expired');
  });

  it('returns localized fileTooLarge / requestTimeout / genericError on 413 / 408 / 500', () => {
    expect(getApiErrorMessage(makeAxiosError(413, {}), 'Fallback')).toContain('25 MB');
    expect(getApiErrorMessage(makeAxiosError(408, {}), 'Fallback')).toContain('timed out');
    expect(getApiErrorMessage(makeAxiosError(500, { message: 'Internal server error' }), 'Fallback')).toContain('Something went wrong');
  });

  it('returns fallback for non-axios errors', () => {
    expect(getApiErrorMessage(new Error('boom'), 'Fallback')).toBe('Fallback');
  });
});
