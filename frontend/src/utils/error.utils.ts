import type { AxiosError } from 'axios';
import type { ApiEnvelope } from '@/types/common.types';
import { translateCurrent } from '@/i18n/standalone';

type ApiErrorEnvelope<T = unknown> = ApiEnvelope<T> & {
  message?: string | string[];
  errorCode?: string;
  details?: unknown;
};

export function getApiErrorMessage(
  error: unknown,
  fallbackMessage: string,
): string {
  const maybeAxiosError = error as AxiosError<ApiErrorEnvelope>;

  if (maybeAxiosError?.isAxiosError) {
    const response = maybeAxiosError.response;
    const data = response?.data;

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
