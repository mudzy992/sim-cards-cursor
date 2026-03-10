import type { UserRole } from './auth.types';

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export type UserListItem = {
  id: string;
  email: string;
  username: string | null;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  distributionId: string | null;
  branchId: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
};

export type UsersResponse = {
  items: UserListItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
