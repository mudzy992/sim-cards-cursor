import type { AxiosError } from 'axios';
import { ERROR_CODE_I18N_MAP, type ApiErrorEnvelope } from '@sim-tracker/shared';
import { useI18nStore } from '@/i18n/i18n.store';

export function getApiErrorMessage(
  error: unknown,
  fallbackMessage: string,
): string {
  const maybeAxiosError = error as AxiosError<ApiErrorEnvelope>;

  if (maybeAxiosError?.isAxiosError) {
    const response = maybeAxiosError.response;
    const data = response?.data;

    if (
      data?.errorCode &&
      Object.prototype.hasOwnProperty.call(ERROR_CODE_I18N_MAP, data.errorCode)
    ) {
      return useI18nStore.getState().t(ERROR_CODE_I18N_MAP[data.errorCode]);
    }

    if (data) {
      if (typeof data.message === 'string' && data.message.trim().length > 0) {
        return data.message;
      }
      if (Array.isArray(data.message) && data.message.length > 0) {
        const firstMsg = data.message.find(
          (m) => typeof m === 'string' && m.trim().length > 0,
        );
        if (firstMsg) return firstMsg;
      }
    }

    if (!response) {
      return 'Ne mogu pristupiti backend-u. Provjeri API adresu i mrežnu konekciju.';
    }

    if (response.status === 401) {
      return 'Nemaš ovlaštenje za ovu radnju ili je sesija istekla.';
    }

    if (response.status >= 500) {
      return 'Došlo je do greške na serveru. Pokušaj ponovo ili kontaktiraj podršku.';
    }
  }

  return fallbackMessage;
}
