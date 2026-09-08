import { axiosInstance } from './axios.instance';
import type { LoginInput, LoginResponse } from '@/types/auth.types';

export const authApi = {
  login: async (payload: LoginInput): Promise<LoginResponse> => {
    const response = await axiosInstance.post('/auth/login', payload);
    return response.data.data as LoginResponse;
  },
  logout: async (): Promise<void> => {
    await axiosInstance.post('/auth/logout');
  },
};
