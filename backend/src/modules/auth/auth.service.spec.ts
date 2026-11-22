import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService (Run 1 Package B security & HMAC refresh)', () => {
  function createMocks() {
    const prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      branchModerator: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      activityLog: {
        create: jest.fn().mockResolvedValue({ id: 'log-1' }),
      },
    };

    const jwtService = {
      signAsync: jest
        .fn()
        .mockImplementation(async (_payload, opts?: { expiresIn?: string }) =>
          opts?.expiresIn === '7d' ? 'signed-refresh-jwt' : 'signed-access-jwt',
        ),
      verifyAsync: jest.fn().mockResolvedValue({ sub: 'u-1', email: 'user@test.local', role: UserRole.USER }),
    };

    const configService = {
      get: jest.fn((key: string, def?: string) => {
        if (key === 'JWT_SECRET') return 'access-secret';
        if (key === 'JWT_REFRESH_SECRET') return 'refresh-secret';
        if (key === 'JWT_EXPIRATION') return '15m';
        if (key === 'JWT_REFRESH_EXPIRATION') return '7d';
        return def;
      }),
      getOrThrow: jest.fn((key: string) => {
        if (key === 'JWT_REFRESH_SECRET') return 'refresh-secret';
        if (key === 'JWT_SECRET') return 'access-secret';
        throw new Error(`Missing ${key}`);
      }),
    };

    const service = new AuthService(
      prisma as unknown as PrismaService,
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
    );

    return { service, prisma, jwtService };
  }

  it('normalizes mixed-case username with trim and lowercase during login and stores hmac-sha256 refresh hash', async () => {
    const { service, prisma } = createMocks();
    const passwordHash = await bcrypt.hash('Secret!123', 4);
    prisma.user.findUnique.mockResolvedValue({
      id: 'u-1',
      email: 'marko@test.local',
      username: 'marko.markovic',
      password: passwordHash,
      firstName: 'Marko',
      lastName: 'Markovic',
      phone: null,
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      avatar: null,
      refreshToken: null,
      distributionId: null,
      branchId: 'branch-1',
      distribution: null,
      branch: { id: 'branch-1', name: 'Zenica', code: 'ZE' },
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: null,
    });

    const result = await service.login({
      emailOrUsername: '  Marko.Markovic  ',
      password: 'Secret!123',
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { username: 'marko.markovic' } }),
    );
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u-1' },
        data: expect.objectContaining({
          refreshToken: expect.stringMatching(/^hmac-sha256:[a-f0-9]{64}$/),
        }),
      }),
    );
    expect(result.accessToken).toBe('signed-access-jwt');
    expect(result.refreshToken).toBe('signed-refresh-jwt');
  });

  it('verifies hmac-sha256 refresh token on refresh and rotates it', async () => {
    const { service, prisma } = createMocks();
    const passwordHash = await bcrypt.hash('Secret!123', 4);
    let savedHash = '';
    prisma.user.update.mockImplementation(async ({ data }) => {
      if (data.refreshToken) savedHash = data.refreshToken;
      return {};
    });

    prisma.user.findUnique.mockResolvedValue({
      id: 'u-1',
      email: 'marko@test.local',
      username: 'marko.markovic',
      password: passwordHash,
      firstName: 'Marko',
      lastName: 'Markovic',
      phone: null,
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      avatar: null,
      refreshToken: null,
      distributionId: null,
      branchId: 'branch-1',
      distribution: null,
      branch: { id: 'branch-1', name: 'Zenica', code: 'ZE' },
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: null,
    });

    await service.login({ emailOrUsername: 'marko.markovic', password: 'Secret!123' });

    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'u-1',
      email: 'marko@test.local',
      username: 'marko.markovic',
      password: passwordHash,
      firstName: 'Marko',
      lastName: 'Markovic',
      phone: null,
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      avatar: null,
      refreshToken: savedHash,
      distributionId: null,
      branchId: 'branch-1',
      distribution: null,
      branch: { id: 'branch-1', name: 'Zenica', code: 'ZE' },
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: null,
    });

    const refreshed = await service.refresh('signed-refresh-jwt');
    expect(refreshed.accessToken).toBe('signed-access-jwt');
    expect(savedHash).toMatch(/^hmac-sha256:[a-f0-9]{64}$/);
  });

  it('rejects mismatched refresh token without calling user update', async () => {
    const { service, prisma } = createMocks();
    prisma.user.findUnique.mockResolvedValue({
      id: 'u-1',
      email: 'marko@test.local',
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      refreshToken: 'hmac-sha256:' + '0'.repeat(64),
    });

    await expect(service.refresh('signed-refresh-jwt')).rejects.toThrow(UnauthorizedException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
