import {
  ConflictException,
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
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });

    if (exists) {
      throw new ConflictException('User with this email already exists');
    }

    const saltRounds = Number(this.configService.get('BCRYPT_SALT_ROUNDS', 12));
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

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
        email: dto.email,
        username,
        password: passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        role: dto.role,
        status: dto.status,
        distributionId: dto.distributionId,
        branchId: dto.branchId,
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
      throw new NotFoundException('User not found');
    }

    return this.toUserListItem(user);
  }

  async update(id: string, dto: UpdateUserDto, actorId?: string, scope?: ScopeContext | null): Promise<UserListItem> {
    await this.ensureExists(id, scope);

    let password: string | undefined;
    if (dto.password) {
      const saltRounds = Number(this.configService.get('BCRYPT_SALT_ROUNDS', 12));
      password = await bcrypt.hash(dto.password, saltRounds);
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        role: dto.role,
        status: dto.status,
        distributionId: dto.distributionId,
        branchId: dto.branchId,
        ...(password ? { password } : {}),
      },
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
    await this.ensureExists(id, scope);

    const updated = await this.prisma.user.update({
      where: { id },
      data: { status },
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
