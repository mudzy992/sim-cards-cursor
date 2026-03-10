export type UserRole = 'SYSTEM_ADMIN' | 'MODERATOR' | 'USER';

export type AuthUser = {
  id: string;
  email: string;
  username: string | null;
  firstName: string;
  lastName: string;
  role: UserRole;
  distributionId?: string | null;
  branchId?: string | null;
  branch?: { id: string; name: string; code: string } | null;
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
