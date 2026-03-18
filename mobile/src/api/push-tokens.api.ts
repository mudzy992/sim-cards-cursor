import { axiosInstance } from './axios.instance';

export const pushTokensApi = {
  register: async (input: {
    token: string;
    platform?: string;
    deviceId?: string;
  }) => {
    await axiosInstance.post('/push-tokens/register', input);
  },

  invalidate: async (token: string) => {
    await axiosInstance.post('/push-tokens/invalidate', { token });
  },
};

