import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/auth.store';
import type { ApiEnvelope } from '@/types/common.types';
import type { LoginResponse } from '@/types/auth.types';

type RetriableConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  _baseUrlIndex?: number;
};

export const getApiBaseUrls = (): string[] => {
  const envBaseUrls = import.meta.env.VITE_API_BASE_URLS as string | undefined;
  if (envBaseUrls) {
    const parsed = envBaseUrls
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (parsed.length > 0) return parsed
  }

  const envBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (envBaseUrl) return [envBaseUrl]

  return ['/backend/api']
};

export const API_BASE_URL = getApiBaseUrls()[0] ?? '/backend/api';

export const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: false,
});

axiosInstance.interceptors.request.use((config) => {
  const requestConfig = config as RetriableConfig;
  const accessToken = useAuthStore.getState().tokens?.accessToken;

  if (!requestConfig.baseURL) {
    requestConfig.baseURL = API_BASE_URL;
  }

  if (requestConfig._baseUrlIndex === undefined) {
    requestConfig._baseUrlIndex = 0;
  }

  if (accessToken) {
    requestConfig.headers.Authorization = `Bearer ${accessToken}`;
  }

  return requestConfig;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableConfig | undefined;

    const isNetworkError = !error.response;
    if (originalRequest && isNetworkError) {
      const baseUrls = getApiBaseUrls();
      const currentIndex = originalRequest._baseUrlIndex ?? 0;
      const nextIndex = currentIndex + 1;

      if (nextIndex < baseUrls.length) {
        originalRequest._baseUrlIndex = nextIndex;
        originalRequest.baseURL = baseUrls[nextIndex];
        return axiosInstance.request(originalRequest);
      }
    }

    if (!originalRequest || originalRequest._retry || error.response?.status !== 401) {
      return Promise.reject(error);
    }

    const authState = useAuthStore.getState();
    const refreshToken = authState.tokens?.refreshToken;

    if (!refreshToken) {
      authState.clearSession();
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const refreshBaseUrl = originalRequest.baseURL ?? API_BASE_URL;
      const refreshResponse = await axiosInstance.post<ApiEnvelope<LoginResponse>>(
        '/auth/refresh',
        { refreshToken },
        { baseURL: refreshBaseUrl },
      );

      const payload = refreshResponse.data.data;
      authState.setSession({
        user: payload.user,
        tokens: {
          accessToken: payload.accessToken,
          refreshToken: payload.refreshToken,
        },
      });

      originalRequest.headers.Authorization = `Bearer ${payload.accessToken}`;
      return axiosInstance(originalRequest);
    } catch (refreshError) {
      authState.clearSession();
      return Promise.reject(refreshError);
    }
  },
);
