import axios, { type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/auth.store';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api';

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

export const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
});

axiosInstance.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as RetriableConfig | undefined;

    if (!originalRequest || originalRequest._retry || error.response?.status !== 401) {
      return Promise.reject(error);
    }

    const state = useAuthStore.getState();
    if (!state.refreshToken) {
      await state.clearSession();
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const refreshResponse = await axios.post(`${API_BASE_URL}/auth/refresh`, {
        refreshToken: state.refreshToken,
      });

      const payload = refreshResponse.data.data;
      await state.setSession({
        user: payload.user,
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
      });

      originalRequest.headers.Authorization = `Bearer ${payload.accessToken}`;
      return axiosInstance(originalRequest);
    } catch (refreshError) {
      await state.clearSession();
      return Promise.reject(refreshError);
    }
  },
);
