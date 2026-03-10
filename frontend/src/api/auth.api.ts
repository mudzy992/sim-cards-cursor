import { axiosInstance } from './axios.instance';
import type { LoginInput, LoginResponse } from '@/types/auth.types';
import type { ApiEnvelope } from '@/types/common.types';

export const authApi = {
  login: async (payload: LoginInput): Promise<LoginResponse> => {
    const response = await axiosInstance.post<ApiEnvelope<LoginResponse>>('/auth/login', payload);
    return response.data.data;
  },
  logout: async (): Promise<void> => {
    await axiosInstance.post('/auth/logout');
  },
  profile: async (): Promise<LoginResponse['user']> => {
    const response = await axiosInstance.get<ApiEnvelope<LoginResponse['user']>>('/auth/profile');
    return response.data.data;
  },
};
