import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { baseUsername, generateUniqueUsername } from '../../common/utils/username-generator.util';
import { normalizeEmail } from '../../common/utils/email-normalizer.util';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ErrorCodes } from '../../common/constants/error-codes';

type SafeUser = {
  id: string;
  email: string;
  username: string | null;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  phone: string | null;
  distributionId: string | null;
  branchId: string | null;
  branch: { id: string; name: string; code: string } | null;
  branchModeratorBranchIds: string[];
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(loginDto: LoginDto, ipAddress?: string) {
    const user = await this.findUserWithBranch(loginDto.emailOrUsername);

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException({
        message: 'Invalid credentials',
        code: ErrorCodes.AUTH_INVALID_CREDENTIALS,
      });
    }

    const passwordMatches = await bcrypt.compare(loginDto.password, user.password);
    if (!passwordMatches) {
      throw new UnauthorizedException({
        message: 'Invalid credentials',
        code: ErrorCodes.AUTH_INVALID_CREDENTIALS,
      });
    }

    const modBranchIds = await this.loadBranchModeratorIds(user.id, user.role);

    const tokenPair = await this.createTokenPair({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshTokenHash = await this.hashToken(tokenPair.refreshToken);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: refreshTokenHash,
        lastLoginAt: new Date(),
      },
    });

    await this.prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        entity: 'auth',
        details: { email: user.email, username: user.username },
        ipAddress,
      },
    });

    return {
      user: this.sanitizeUser(user, modBranchIds),
      ...tokenPair,
    };
  }

  async register(registerDto: RegisterDto, createdById?: string) {
    const normalizedEmail = normalizeEmail(registerDto.email);
    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException({
        message: 'Email is already in use',
        code: ErrorCodes.AUTH_EMAIL_IN_USE,
      });
    }

    const saltRounds = Number(this.configService.get('BCRYPT_SALT_ROUNDS', 12));
    const passwordHash = await bcrypt.hash(registerDto.password, saltRounds);

    const base = baseUsername(registerDto.firstName, registerDto.lastName);
    const username = await generateUniqueUsername(base, async (candidate) => {
      const exists = await this.prisma.user.findUnique({
        where: { username: candidate },
        select: { id: true },
      });
      return !!exists;
    });

    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        username,
        password: passwordHash,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        phone: registerDto.phone,
        role: registerDto.role ?? UserRole.USER,
        status: UserStatus.ACTIVE,
      },
    });

    await this.prisma.activityLog.create({
      data: {
        userId: createdById,
        action: 'CREATE',
        entity: 'user',
        entityId: user.id,
        details: { email: user.email, role: user.role },
      },
    });

    return this.sanitizeUser(user);
  }

  async refresh(refreshToken: string) {
    let payload: JwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException({
        message: 'Invalid refresh token',
        code: ErrorCodes.AUTH_INVALID_REFRESH_TOKEN,
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        distribution: { select: { id: true } },
        branch: { select: { id: true, name: true, code: true } },
      },
    });

    if (!user || !user.refreshToken || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException({
        message: 'Refresh token rejected',
        code: ErrorCodes.AUTH_INVALID_REFRESH_TOKEN,
      });
    }

    const tokenMatches = await this.verifyTokenHash(refreshToken, user.refreshToken);
    if (!tokenMatches) {
      throw new UnauthorizedException({
        message: 'Refresh token mismatch',
        code: ErrorCodes.AUTH_INVALID_REFRESH_TOKEN,
      });
    }

    const tokenPair = await this.createTokenPair({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: await this.hashToken(tokenPair.refreshToken),
      },
    });

    const modBranchIds = await this.loadBranchModeratorIds(user.id, user.role);
    return {
      user: this.sanitizeUser(user, modBranchIds),
      ...tokenPair,
    };
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });

    await this.prisma.activityLog.create({
      data: {
        userId,
        action: 'LOGOUT',
        entity: 'auth',
      },
    });

    return { loggedOut: true };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('New password must be different');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const currentMatches = await bcrypt.compare(dto.currentPassword, user.password);
    if (!currentMatches) {
      throw new UnauthorizedException('Current password is invalid');
    }

    const saltRounds = Number(this.configService.get('BCRYPT_SALT_ROUNDS', 12));
    const newPasswordHash = await bcrypt.hash(dto.newPassword, saltRounds);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: newPasswordHash,
        refreshToken: null,
      },
    });

    await this.prisma.activityLog.create({
      data: {
        userId,
        action: 'CHANGE_PASSWORD',
        entity: 'auth',
      },
    });

    return { changed: true };
  }

  async verifyPassword(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true, status: true },
    });
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User not found');
    }

    const matches = await bcrypt.compare(password, user.password);
    if (!matches) {
      throw new UnauthorizedException('Password is invalid');
    }

    return { verified: true };
  }

  async profile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        distribution: { select: { id: true } },
        branch: { select: { id: true, name: true, code: true } },
      },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const modBranchIds = await this.loadBranchModeratorIds(user.id, user.role);
    return this.sanitizeUser(user, modBranchIds);
  }

  private async createTokenPair(payload: JwtPayload) {
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      expiresIn: this.configService.get<string>('JWT_EXPIRATION', '15m'),
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRATION', '7d'),
    });

    return { accessToken, refreshToken };
  }

  private computeHmacTokenDigest(token: string): string {
    const secret = this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    return crypto.createHmac('sha256', secret).update(token).digest('hex');
  }

  private preHashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async hashToken(token: string): Promise<string> {
    return `hmac-sha256:${this.computeHmacTokenDigest(token)}`;
  }

  private async verifyTokenHash(token: string, storedHash: string): Promise<boolean> {
    if (storedHash.startsWith('hmac-sha256:')) {
      const actualHex = storedHash.slice('hmac-sha256:'.length);
      const expectedHex = this.computeHmacTokenDigest(token);
      if (actualHex.length !== expectedHex.length) {
        return false;
      }
      return crypto.timingSafeEqual(
        Buffer.from(actualHex, 'utf8'),
        Buffer.from(expectedHex, 'utf8'),
      );
    }

    // Fallback for legacy bcrypt refresh token hashes
    const shaMatches = await bcrypt.compare(this.preHashToken(token), storedHash);
    if (shaMatches) return true;
    return bcrypt.compare(token, storedHash);
  }

  private async findUserWithBranch(emailOrUsername: string) {
    const trimmed = emailOrUsername.trim();
    const isEmail = trimmed.includes('@');
    const where = isEmail
      ? { email: normalizeEmail(trimmed) }
      : { username: trimmed.toLowerCase() };
    return this.prisma.user.findUnique({
      where,
      include: {
        distribution: { select: { id: true } },
        branch: { select: { id: true, name: true, code: true } },
      },
    });
  }

  private async loadBranchModeratorIds(userId: string, role: UserRole): Promise<string[]> {
    if (role !== UserRole.USER) return [];
    const entries = await this.prisma.branchModerator.findMany({
      where: { userId },
      select: { branchId: true },
    });
    return entries.map((e) => e.branchId);
  }

  private sanitizeUser(
    user: {
      id: string;
      email: string;
      username?: string | null;
      firstName: string;
      lastName: string;
      role: UserRole;
      status: UserStatus;
      phone: string | null;
      distributionId?: string | null;
      distribution?: { id: string } | null;
      branchId?: string | null;
      branch?: { id: string; name: string; code: string } | null;
    },
    branchModeratorBranchIds: string[] = [],
  ): SafeUser {
    const distributionId = user.distributionId ?? user.distribution?.id ?? null;
    const branchId = user.branchId ?? user.branch?.id ?? null;
    return {
      id: user.id,
      email: user.email,
      username: user.username ?? null,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
      phone: user.phone,
      distributionId,
      branchId,
      branch: user.branch ? { id: user.branch.id, name: user.branch.name, code: user.branch.code } : null,
      branchModeratorBranchIds,
    };
  }
}
