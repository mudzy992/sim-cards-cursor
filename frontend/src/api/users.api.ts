import { axiosInstance } from './axios.instance';
import type { ApiEnvelope } from '@/types/common.types';
import type { UsersResponse, UserListItem } from '@/types/user.types';

export type CreateUserInput = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role?: string;
  status?: string;
  distributionId?: string;
  branchId?: string;
};

export type UpdateUserInput = Partial<CreateUserInput> & { password?: string };

const unwrap = <T>(r: { data: { data?: T } | T }): T =>
  (r.data as { data?: T }).data ?? (r.data as T);

export const usersApi = {
  list: async (params?: { role?: string; limit?: number; page?: number }): Promise<UsersResponse> => {
    const response = await axiosInstance.get<ApiEnvelope<UsersResponse>>('/users', {
      params: params ?? {},
    });
    return response.data.data;
  },

  getOne: async (id: string): Promise<UserListItem> => {
    const response = await axiosInstance.get(`/users/${id}`);
    return unwrap<UserListItem>(response.data);
  },

  create: async (data: CreateUserInput): Promise<UserListItem> => {
    const response = await axiosInstance.post('/users', data);
    return unwrap<UserListItem>(response.data);
  },

  update: async (id: string, data: UpdateUserInput): Promise<UserListItem> => {
    const response = await axiosInstance.patch(`/users/${id}`, data);
    return unwrap<UserListItem>(response.data);
  },

  delete: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/users/${id}`);
  },
};
