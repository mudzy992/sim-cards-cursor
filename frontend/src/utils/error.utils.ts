import type { AxiosError } from 'axios';
import type { ApiEnvelope } from '@/types/common.types';
import { translateCurrent } from '@/i18n/standalone';

type ApiErrorEnvelope<T = unknown> = ApiEnvelope<T> & {
  message?: string | string[];
  errorCode?: string;
  details?: unknown;
};

const KNOWN_ERROR_CODE_KEYS: Record<string, string> = {
  AUTH_INVALID_CREDENTIALS: 'errors.codes.AUTH_INVALID_CREDENTIALS',
  AUTH_INVALID_REFRESH_TOKEN: 'errors.codes.AUTH_INVALID_REFRESH_TOKEN',
  AUTH_EMAIL_IN_USE: 'errors.codes.AUTH_EMAIL_IN_USE',
  PRISMA_UNIQUE_CONFLICT: 'errors.codes.PRISMA_UNIQUE_CONFLICT',
  PRISMA_RECORD_NOT_FOUND: 'errors.codes.PRISMA_RECORD_NOT_FOUND',
  PRISMA_FOREIGN_KEY_VIOLATION: 'errors.codes.PRISMA_FOREIGN_KEY_VIOLATION',
  PRISMA_RELATION_VIOLATION: 'errors.codes.PRISMA_RELATION_VIOLATION',
};

export function getApiErrorMessage(
  error: unknown,
  fallbackMessage: string,
): string {
  const maybeAxiosError = error as AxiosError<ApiErrorEnvelope>;

  if (maybeAxiosError?.isAxiosError) {
    const response = maybeAxiosError.response;
    const data = response?.data;

    if (data?.errorCode && data.errorCode in KNOWN_ERROR_CODE_KEYS) {
      return translateCurrent(KNOWN_ERROR_CODE_KEYS[data.errorCode]);
    }

    if (data) {
      if (typeof data.message === 'string' && data.message.trim().length > 0) {
        return data.message;
      }
      if (Array.isArray(data.message) && data.message.length > 0) {
        const firstMsg = data.message.find((m) => typeof m === 'string' && m.trim().length > 0);
        if (firstMsg) return firstMsg;
      }
    }

    if (!response) {
      return translateCurrent('common.messages.networkError');
    }

    if (response.status === 401) {
      return translateCurrent('common.messages.sessionExpired');
    }

    if (response.status >= 500) {
      return translateCurrent('common.messages.genericError');
    }
  }

  return fallbackMessage;
}
