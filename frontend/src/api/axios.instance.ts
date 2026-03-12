import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/auth.store';
import type { ApiEnvelope } from '@/types/common.types';
import type { LoginResponse } from '@/types/auth.types';

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api';

export const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: false,
});

axiosInstance.interceptors.request.use((config) => {
  const accessToken = useAuthStore.getState().tokens?.accessToken;

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableConfig | undefined;

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
      const refreshResponse = await axios.post<ApiEnvelope<LoginResponse>>(
        `${API_BASE_URL}/auth/refresh`,
        { refreshToken },
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
