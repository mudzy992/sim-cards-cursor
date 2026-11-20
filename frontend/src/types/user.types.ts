import type { UserRole, UserStatus } from '@sim-tracker/shared';
import type { PaginatedResult } from './common.types';

export type { UserStatus };

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

export type UsersResponse = PaginatedResult<UserListItem>;
