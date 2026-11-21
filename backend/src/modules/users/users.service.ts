import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, User, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { scopeWhere, ScopeContext } from '../../common/utils/scope-filter.util';
import { baseUsername, generateUniqueUsername } from '../../common/utils/username-generator.util';
import { normalizeEmail } from '../../common/utils/email-normalizer.util';
import { ErrorCodes } from '../../common/constants/error-codes';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserFilterDto } from './dto/user-filter.dto';

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
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async create(dto: CreateUserDto, actorId?: string): Promise<UserListItem> {
    const normalizedEmail = normalizeEmail(dto.email);
    const exists = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (exists) {
      throw new ConflictException({
        message: 'User with this email already exists',
        code: ErrorCodes.USER_EMAIL_EXISTS,
      });
    }

    const saltRounds = Number(this.configService.get('BCRYPT_SALT_ROUNDS', 12));
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    const targetRole = dto.role ?? UserRole.USER;
    const resolvedOrg = await this.validateAndNormalizeOrgAssignment({
      role: targetRole,
      distributionId: dto.distributionId,
      branchId: dto.branchId,
    });

    const base = baseUsername(dto.firstName, dto.lastName);
    const username = await generateUniqueUsername(base, async (candidate) => {
      const exists = await this.prisma.user.findUnique({
        where: { username: candidate },
        select: { id: true },
      });
      return !!exists;
    });

    const created = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        username,
        password: passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        role: targetRole,
        status: dto.status,
        distributionId: resolvedOrg.distributionId,
        branchId: resolvedOrg.branchId,
      },
      include: { distribution: { select: { id: true, name: true, code: true } }, branch: { select: { id: true, name: true, code: true } } },
    });

    await this.prisma.activityLog.create({
      data: {
        userId: actorId,
        action: 'CREATE',
        entity: 'user',
        entityId: created.id,
        details: { email: created.email, role: created.role },
      },
    });

    return this.toUserListItem(created);
  }

  async findAll(filter: UserFilterDto, scope?: ScopeContext | null): Promise<PaginatedResult<UserListItem>> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;

    const scopeClause = scopeWhere(scope, { userScope: true });
    const where: Prisma.UserWhereInput = {
      ...(filter.role ? { role: filter.role } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.search
        ? {
            OR: [
              { email: { contains: filter.search } },
              { firstName: { contains: filter.search } },
              { lastName: { contains: filter.search } },
            ],
          }
        : {}),
      ...(scopeClause ? { AND: [scopeClause] } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { distribution: { select: { id: true, name: true, code: true } }, branch: { select: { id: true, name: true, code: true } } },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toUserListItem(item)),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findOne(id: string, scope?: ScopeContext | null): Promise<UserListItem> {
    const scopeClause = scopeWhere(scope, { userScope: true });
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        ...(scopeClause ? { AND: [scopeClause] } : {}),
      },
      include: { distribution: { select: { id: true, name: true, code: true } }, branch: { select: { id: true, name: true, code: true } } },
    });
    if (!user) {
      throw new NotFoundException({
        message: 'User not found',
        code: ErrorCodes.USER_NOT_FOUND,
      });
    }

    return this.toUserListItem(user);
  }

  async update(id: string, dto: UpdateUserDto, actorId?: string, scope?: ScopeContext | null): Promise<UserListItem> {
    const scopeClause = scopeWhere(scope, { userScope: true });
    const existing = await this.prisma.user.findFirst({
      where: {
        id,
        ...(scopeClause ? { AND: [scopeClause] } : {}),
      },
      select: { id: true, role: true, email: true, distributionId: true, branchId: true },
    });

    if (!existing) {
      throw new NotFoundException({
        message: 'User not found',
        code: ErrorCodes.USER_NOT_FOUND,
      });
    }

    if (scope && scope.role === UserRole.DIST_ADMIN) {
      if (existing.role === UserRole.SYSTEM_ADMIN) {
        throw new ForbiddenException({
          message: 'Cannot modify a system administrator',
          code: ErrorCodes.USER_CANNOT_MODIFY_SYSTEM_ADMIN,
        });
      }
      if (dto.role === UserRole.SYSTEM_ADMIN) {
        throw new ForbiddenException({
          message: 'DIST_ADMIN cannot assign SYSTEM_ADMIN role',
          code: ErrorCodes.USER_CANNOT_ASSIGN_SYSTEM_ADMIN,
        });
      }
      if (dto.role !== undefined && dto.role !== existing.role) {
        throw new ForbiddenException({
          message: 'DIST_ADMIN cannot change user role',
          code: ErrorCodes.FORBIDDEN,
        });
      }
      const effectiveRole = dto.role ?? existing.role;
      if (effectiveRole === UserRole.DIST_ADMIN) {
        if (dto.distributionId !== undefined && dto.distributionId !== scope.distributionId) {
          throw new ForbiddenException({
            message: 'Cannot reassign user outside your distribution',
            code: ErrorCodes.USER_CANNOT_REASSIGN_DISTRIBUTION,
          });
        }
      } else if (dto.distributionId !== undefined && dto.distributionId !== null) {
        throw new ForbiddenException({
          message: 'Cannot reassign user outside your distribution',
          code: ErrorCodes.USER_CANNOT_REASSIGN_DISTRIBUTION,
        });
      }
      if (dto.branchId) {
        const branch = await this.prisma.branch.findUnique({
          where: { id: dto.branchId },
          select: { distributionId: true },
        });
        if (!branch || branch.distributionId !== scope.distributionId) {
          throw new ForbiddenException({
            message: 'Target branch is outside your distribution',
            code: ErrorCodes.USER_BRANCH_OUTSIDE_DISTRIBUTION,
          });
        }
      }
    }

    const nextRole = dto.role ?? existing.role;
    const resolvedOrg = await this.validateAndNormalizeOrgAssignment({
      role: nextRole,
      distributionId: dto.distributionId !== undefined ? dto.distributionId : existing.distributionId,
      branchId: dto.branchId !== undefined ? dto.branchId : existing.branchId,
    });

    let nextEmail: string | undefined;
    if (dto.email !== undefined) {
      nextEmail = normalizeEmail(dto.email);
      if (nextEmail !== existing.email) {
        const dup = await this.prisma.user.findUnique({
          where: { email: nextEmail },
          select: { id: true },
        });
        if (dup) {
          throw new ConflictException({
            message: 'User with this email already exists',
            code: ErrorCodes.USER_EMAIL_EXISTS,
          });
        }
      }
    }

    let password: string | undefined;
    if (dto.password) {
      const saltRounds = Number(this.configService.get('BCRYPT_SALT_ROUNDS', 12));
      password = await bcrypt.hash(dto.password, saltRounds);
    }

    const shouldClearRefreshToken =
      Boolean(password) ||
      (dto.role !== undefined && dto.role !== existing.role) ||
      (dto.status !== undefined && dto.status !== UserStatus.ACTIVE);

    const roleLeftUser = existing.role === UserRole.USER && nextRole !== UserRole.USER;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (roleLeftUser) {
        await tx.branchModerator.deleteMany({ where: { userId: id } });
      }
      return tx.user.update({
        where: { id },
        data: {
          email: nextEmail,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          role: dto.role,
          status: dto.status,
          distributionId: resolvedOrg.distributionId,
          branchId: resolvedOrg.branchId,
          ...(password ? { password } : {}),
          ...(shouldClearRefreshToken ? { refreshToken: null } : {}),
        },
      });
    });

    await this.prisma.activityLog.create({
      data: {
        userId: actorId,
        action: 'UPDATE',
        entity: 'user',
        entityId: id,
        details: { fields: Object.keys(dto) },
      },
    });

    return this.toUserListItem(updated);
  }

  async remove(id: string, actorId?: string, scope?: ScopeContext | null): Promise<{ deleted: boolean }> {
    await this.ensureExists(id, scope);

    await this.prisma.user.delete({ where: { id } });

    await this.prisma.activityLog.create({
      data: {
        userId: actorId,
        action: 'DELETE',
        entity: 'user',
        entityId: id,
      },
    });

    return { deleted: true };
  }

  async updateStatus(
    id: string,
    status: UserStatus,
    actorId?: string,
    scope?: ScopeContext | null,
  ): Promise<UserListItem> {
    const scopeClause = scopeWhere(scope, { userScope: true });
    const existing = await this.prisma.user.findFirst({
      where: {
        id,
        ...(scopeClause ? { AND: [scopeClause] } : {}),
      },
      select: { id: true, role: true },
    });

    if (!existing) {
      throw new NotFoundException({
        message: 'User not found',
        code: ErrorCodes.USER_NOT_FOUND,
      });
    }

    if (scope?.role === UserRole.DIST_ADMIN && existing.role === UserRole.SYSTEM_ADMIN) {
      throw new ForbiddenException({
        message: 'Cannot modify a system administrator',
        code: ErrorCodes.USER_CANNOT_MODIFY_SYSTEM_ADMIN,
      });
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        status,
        ...(status !== UserStatus.ACTIVE ? { refreshToken: null } : {}),
      },
      include: { distribution: { select: { id: true, name: true, code: true } }, branch: { select: { id: true, name: true, code: true } } },
    });

    await this.prisma.activityLog.create({
      data: {
        userId: actorId,
        action: 'STATUS_CHANGE',
        entity: 'user',
        entityId: id,
        details: { status },
      },
    });

    return this.toUserListItem(updated);
  }

  private async validateAndNormalizeOrgAssignment(input: {
    role: UserRole;
    distributionId?: string | null;
    branchId?: string | null;
  }): Promise<{ distributionId: string | null; branchId: string | null }> {
    const normalizedDistId =
      input.role === UserRole.DIST_ADMIN ? (input.distributionId ?? null) : null;
    const normalizedBranchId =
      input.role === UserRole.USER ? (input.branchId ?? null) : null;

    if (normalizedDistId) {
      const dist = await this.prisma.distribution.findUnique({
        where: { id: normalizedDistId },
        select: { id: true },
      });
      if (!dist) {
        throw new NotFoundException('Distribution not found');
      }
    }

    if (normalizedBranchId) {
      const branch = await this.prisma.branch.findUnique({
        where: { id: normalizedBranchId },
        select: { id: true, distributionId: true },
      });
      if (!branch) {
        throw new NotFoundException('Branch not found');
      }
      if (normalizedDistId && branch.distributionId !== normalizedDistId) {
        throw new BadRequestException('Branch does not belong to selected distribution');
      }
    }

    return {
      distributionId: normalizedDistId,
      branchId: normalizedBranchId,
    };
  }

  private async ensureExists(id: string, scope?: ScopeContext | null): Promise<void> {
    const scopeClause = scopeWhere(scope, { userScope: true });
    const exists = await this.prisma.user.findFirst({
      where: {
        id,
        ...(scopeClause ? { AND: [scopeClause] } : {}),
      },
      select: { id: true },
    });

    if (!exists) {
      throw new NotFoundException('User not found');
    }
  }

  private toUserListItem(user: User & { distribution?: { id: string; name: string; code: string } | null; branch?: { id: string; name: string; code: string } | null }): UserListItem {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role,
      status: user.status,
      distributionId: user.distributionId,
      branchId: user.branchId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
    };
  }
}
