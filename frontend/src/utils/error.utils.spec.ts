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
  });

  it('returns localized network error when no response', () => {
    const err = makeAxiosError(undefined);
    expect(getApiErrorMessage(err, 'Fallback')).toContain('internet connection');
  });

  it('returns localized session expired error on 401 without body message', () => {
    const err = makeAxiosError(401, {});
    expect(getApiErrorMessage(err, 'Fallback')).toContain('expired');
  });

  it('returns fallback for non-axios errors', () => {
    expect(getApiErrorMessage(new Error('boom'), 'Fallback')).toBe('Fallback');
  });
});
