import type { UserRole, UserStatus } from './enums.js';

export type ApiEnvelope<T> = {
  success: boolean;
  data: T;
};

export type ApiErrorEnvelope<T = unknown> = Partial<ApiEnvelope<T>> & {
  statusCode?: number;
  message?: string | string[];
  errorCode?: string;
  details?: unknown;
};

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type AuthUserBranchRef = {
  id: string;
  name: string;
  code: string;
};

export type AuthUser = {
  id: string;
  email: string;
  username: string | null;
  firstName: string;
  lastName: string;
  role: UserRole;
  status?: UserStatus;
  phone?: string | null;
  distributionId?: string | null;
  branchId?: string | null;
  branch?: AuthUserBranchRef | null;
  branchModeratorBranchIds?: string[];
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type LoginInput = {
  emailOrUsername: string;
  password: string;
};

export type LoginResponse = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};
