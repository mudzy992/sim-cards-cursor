import type { AxiosError } from 'axios';
import type { ApiEnvelope } from '@/types/common.types';

type ApiErrorEnvelope<T = unknown> = ApiEnvelope<T> & {
  message?: string;
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

    if (data && typeof data.message === 'string') {
      return data.message;
    }

    if (!response) {
      return 'Backend nije dostupan. Provjeri API adresu i mrežnu konekciju.';
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

