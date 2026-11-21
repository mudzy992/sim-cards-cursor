import type { AxiosError } from 'axios';
import { ERROR_CODE_I18N_MAP, type ApiErrorEnvelope } from '@sim-tracker/shared';
import { translateCurrent } from '@/i18n/standalone';

export function getApiErrorMessage(
  error: unknown,
  fallbackMessage: string,
): string {
  const maybeAxiosError = error as AxiosError<ApiErrorEnvelope>;

  if (maybeAxiosError?.isAxiosError) {
    const response = maybeAxiosError.response;
    const data = response?.data;

    if (data?.errorCode && Object.prototype.hasOwnProperty.call(ERROR_CODE_I18N_MAP, data.errorCode)) {
      return translateCurrent(ERROR_CODE_I18N_MAP[data.errorCode]);
    }

    if (!response) {
      return translateCurrent('common.messages.networkError');
    }

    if (response.status === 413) {
      return translateCurrent('common.messages.fileTooLarge');
    }

    if (response.status === 408) {
      return translateCurrent('common.messages.requestTimeout');
    }

    if (response.status >= 500) {
      return translateCurrent('common.messages.genericError');
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

    if (response.status === 401) {
      return translateCurrent('common.messages.sessionExpired');
    }
  }

  return fallbackMessage;
}
