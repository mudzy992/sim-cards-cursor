import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { scopeWhere } from 'src/common/utils/scope-filter.util';
import { CreateRecipientGroupDto } from './dto/create-recipient-group.dto';
import { UpdateRecipientGroupDto } from './dto/update-recipient-group.dto';
import { CreateRecipientDto } from './dto/create-recipient.dto';
import { UpdateRecipientDto } from './dto/update-recipient.dto';
import { RecipientGroup, Recipient, RecipientGroupType, UserRole } from '@prisma/client';

@Injectable()
export class RecipientsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertGroupAccess(
    groupId: string,
    actor?: { role: UserRole; distributionId?: string | null },
  ): Promise<RecipientGroup> {
    const group = await this.prisma.recipientGroup.findUnique({
      where: { id: groupId },
    });
    if (!group) throw new NotFoundException('Grupa nije pronađena.');
    if (actor?.role === UserRole.MODERATOR) {
      if (!actor.distributionId || group.distributionId !== actor.distributionId) {
        throw new ForbiddenException(
          'Moderator može moderirati samo svoje distribucijske grupe.',
        );
      }
    }
    return group;
  }

  async getUsersForPicker(distributionId?: string): Promise<{ id: string; email: string; firstName: string; lastName: string }[]> {
    const scope = distributionId
      ? { role: 'MODERATOR' as const, distributionId, branchId: null }
      : { role: 'SYSTEM_ADMIN' as const, distributionId: null, branchId: null };
    const scopeClause = scopeWhere(scope, { userScope: true });
    const where = {
      status: 'ACTIVE' as const,
      ...(scopeClause ? { AND: [scopeClause] } : {}),
    };
    const users = await this.prisma.user.findMany({
      where,
      take: 500,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    return users;
  }

  async findAllGroups(distributionId?: string): Promise<RecipientGroup[]> {
    const where = distributionId ? { distributionId } : undefined;
    return this.prisma.recipientGroup.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        recipients: {
          where: { isActive: true },
          orderBy: { lastName: 'asc' },
        },
        groupUsers: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
              },
            },
          },
        },
      },
    });
  }

  async getApprovalGroupForBranch(branchId: string) {
    const mapping = await this.prisma.branchApprovalGroup.findFirst({
      where: {
        branchId,
        recipientGroup: { type: RecipientGroupType.APPROVAL },
      },
      include: {
        recipientGroup: {
          include: {
            recipients: { where: { isActive: true } },
            groupUsers: { include: { user: { select: { id: true, email: true } } } },
          },
        },
      },
    });
    return mapping?.recipientGroup ?? null;
  }

  /** Vraća sve email adrese i user ID-eve za grupu (Recipients + RecipientGroupUser) */
  async getEmailsAndUserIdsForGroup(groupId: string): Promise<{ emails: string[]; userIds: string[] }> {
    const [recipients, groupUsers] = await Promise.all([
      this.prisma.recipient.findMany({
        where: { groupId, isActive: true },
        select: { email: true },
      }),
      this.prisma.recipientGroupUser.findMany({
        where: { recipientGroupId: groupId },
        include: { user: { select: { id: true, email: true } } },
      }),
    ]);
    const emails = [...new Set([
      ...recipients.map((r) => r.email),
      ...groupUsers.map((gu) => gu.user.email),
    ])];
    const userIds = groupUsers.map((gu) => gu.user.id);
    return { emails, userIds };
  }

  async addUserToGroup(
    recipientGroupId: string,
    userId: string,
    actor?: { role: UserRole; distributionId?: string | null },
  ): Promise<{ recipientGroupId: string; userId: string }> {
    await this.assertGroupAccess(recipientGroupId, actor);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        branch: { select: { distributionId: true } },
      },
    });
    if (!user) throw new BadRequestException('Korisnik nije pronađen.');
    if (actor?.role === UserRole.MODERATOR) {
      const userDistributionId = user.distributionId ?? user.branch?.distributionId ?? null;
      if (!actor.distributionId || userDistributionId !== actor.distributionId) {
        throw new ForbiddenException(
          'Moderator može dodavati samo korisnike iz svoje distribucije.',
        );
      }
    }
    await this.prisma.recipientGroupUser.upsert({
      where: {
        recipientGroupId_userId: { recipientGroupId, userId },
      },
      create: { recipientGroupId, userId },
      update: {},
    });
    return { recipientGroupId, userId };
  }

  async removeUserFromGroup(
    recipientGroupId: string,
    userId: string,
    actor?: { role: UserRole; distributionId?: string | null },
  ): Promise<void> {
    await this.assertGroupAccess(recipientGroupId, actor);
    await this.prisma.recipientGroupUser.deleteMany({
      where: { recipientGroupId, userId },
    });
  }

  async getGroupUsers(
    recipientGroupId: string,
    actor?: { role: UserRole; distributionId?: string | null },
  ) {
    await this.assertGroupAccess(recipientGroupId, actor);
    return this.prisma.recipientGroupUser.findMany({
      where: { recipientGroupId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });
  }

  async isUserInApprovalGroupForBranch(
    userId: string,
    branchId: string,
  ): Promise<boolean> {
    const count = await this.prisma.branchApprovalGroup.count({
      where: {
        branchId,
        recipientGroup: {
          type: RecipientGroupType.APPROVAL,
          groupUsers: { some: { userId } },
        },
      },
    });
    return count > 0;
  }

  async getUserApprovalPermissionsForBranch(
    userId: string,
    branchId: string | null,
  ): Promise<{
    canApproveFromPending: boolean;
    canRejectFromPending: boolean;
    canActivateSep: boolean;
    canSendPdf: boolean;
  } | null> {
    if (!branchId) return null;
    const mapping = await this.prisma.branchApprovalGroup.findFirst({
      where: {
        branchId,
        recipientGroup: {
          type: RecipientGroupType.APPROVAL,
          groupUsers: {
            some: { userId },
          },
        },
      },
      include: {
        recipientGroup: {
          include: {
            groupUsers: {
              where: { userId },
              take: 1,
            },
          },
        },
      },
    });

    const gu = mapping?.recipientGroup.groupUsers[0];
    if (!gu) return null;

    return {
      canApproveFromPending: gu.canApproveFromPending,
      canRejectFromPending: gu.canRejectFromPending,
      canActivateSep: gu.canActivateSep,
      canSendPdf: gu.canSendPdf,
    };
  }

  async findGroupById(
    id: string,
    actor?: { role: UserRole; distributionId?: string | null },
  ): Promise<RecipientGroup> {
    await this.assertGroupAccess(id, actor);
    const group = await this.prisma.recipientGroup.findUnique({
      where: { id },
      include: { recipients: true },
    });
    if (!group) {
      throw new NotFoundException(`Recipient group with ID ${id} not found`);
    }
    return group;
  }

  async createGroup(dto: CreateRecipientGroupDto): Promise<RecipientGroup> {
    return this.prisma.recipientGroup.create({
      data: {
        name: dto.name,
        description: dto.description,
        ...(dto.type && { type: dto.type }),
        ...(dto.distributionId && { distributionId: dto.distributionId }),
      },
    });
  }

  async updateGroup(
    id: string,
    dto: UpdateRecipientGroupDto,
    actor?: { role: UserRole; distributionId?: string | null },
  ): Promise<RecipientGroup> {
    await this.assertGroupAccess(id, actor);
    return this.prisma.recipientGroup.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.distributionId !== undefined && { distributionId: dto.distributionId }),
      },
    });
  }

  async removeGroup(
    id: string,
    actor?: { role: UserRole; distributionId?: string | null },
  ): Promise<RecipientGroup> {
    await this.assertGroupAccess(id, actor);
    return this.prisma.recipientGroup.delete({
      where: { id },
    });
  }

  async createRecipient(
    dto: CreateRecipientDto,
    actor?: { role: UserRole; distributionId?: string | null },
  ): Promise<Recipient> {
    const group = await this.assertGroupAccess(dto.groupId, actor);
    if (group.type === RecipientGroupType.APPROVAL) {
      throw new BadRequestException(
        'APPROVAL grupe ne mogu imati ručno unesene email primaoce. Dodajte korisnike aplikacije u grupu.',
      );
    }
    return this.prisma.recipient.create({
      data: {
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        position: dto.position,
        isActive: dto.isActive ?? true,
        groupId: dto.groupId,
      },
    });
  }

  async updateRecipient(
    id: string,
    dto: UpdateRecipientDto,
    actor?: { role: UserRole; distributionId?: string | null },
  ): Promise<Recipient> {
    const recipient = await this.prisma.recipient.findUnique({
      where: { id },
    });
    if (!recipient) {
      throw new NotFoundException(`Recipient with ID ${id} not found`);
    }
    await this.assertGroupAccess(recipient.groupId, actor);
    if (dto.groupId) {
      const targetGroup = await this.assertGroupAccess(dto.groupId, actor);
      if (targetGroup.type === RecipientGroupType.APPROVAL) {
        throw new BadRequestException(
          'APPROVAL grupe ne mogu imati ručno unesene email primaoce. Dodajte korisnike aplikacije u grupu.',
        );
      }
    }
    return this.prisma.recipient.update({
      where: { id },
      data: dto,
    });
  }

  async removeRecipient(
    id: string,
    actor?: { role: UserRole; distributionId?: string | null },
  ): Promise<Recipient> {
    const recipient = await this.prisma.recipient.findUnique({
      where: { id },
    });
    if (!recipient) {
      throw new NotFoundException(`Recipient with ID ${id} not found`);
    }
    await this.assertGroupAccess(recipient.groupId, actor);
    return this.prisma.recipient.delete({
      where: { id },
    });
  }

  async setBranchApprovalGroup(
    branchId: string,
    recipientGroupId: string,
    actor?: { role: UserRole; distributionId?: string | null },
  ): Promise<{ branchId: string; recipientGroupId: string }> {
    const group = await this.assertGroupAccess(recipientGroupId, actor);
    if (group.type !== RecipientGroupType.APPROVAL) {
      throw new BadRequestException(
        'Samo APPROVAL grupa može biti mapirana za odobravanje.',
      );
    }
    if (actor?.role === UserRole.MODERATOR) {
      const branch = await this.prisma.branch.findUnique({
        where: { id: branchId },
        select: { distributionId: true },
      });
      if (
        !branch ||
        !actor.distributionId ||
        branch.distributionId !== actor.distributionId
      ) {
        throw new ForbiddenException(
          'Moderator može mapirati samo podružnice svoje distribucije.',
        );
      }
    }
    await this.prisma.branchApprovalGroup.upsert({
      where: { branchId },
      create: { branchId, recipientGroupId },
      update: { recipientGroupId },
    });
    return { branchId, recipientGroupId };
  }

  async getBranchApprovalMappings(distributionId?: string) {
    const where = distributionId
      ? { branch: { distributionId } }
      : {};
    return this.prisma.branchApprovalGroup.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true, code: true, distributionId: true } },
        recipientGroup: { select: { id: true, name: true } },
      },
    });
  }

  async removeBranchApprovalGroup(
    branchId: string,
    actor?: { role: UserRole; distributionId?: string | null },
  ): Promise<void> {
    if (actor?.role === UserRole.MODERATOR) {
      const branch = await this.prisma.branch.findUnique({
        where: { id: branchId },
        select: { distributionId: true },
      });
      if (
        !branch ||
        !actor.distributionId ||
        branch.distributionId !== actor.distributionId
      ) {
        throw new ForbiddenException(
          'Moderator može ukloniti mapiranje samo za svoju distribuciju.',
        );
      }
    }
    await this.prisma.branchApprovalGroup.deleteMany({
      where: { branchId },
    });
  }

  async getActiveEmailsByGroupIds(groupIds: string[]): Promise<string[]> {
    const [recipients, groupUsers] = await Promise.all([
      this.prisma.recipient.findMany({
        where: {
          groupId: { in: groupIds },
          isActive: true,
        },
        select: { email: true },
      }),
      this.prisma.recipientGroupUser.findMany({
        where: { recipientGroupId: { in: groupIds } },
        include: { user: { select: { email: true } } },
      }),
    ]);
    return [...new Set([
      ...recipients.map((r) => r.email),
      ...groupUsers.map((gu) => gu.user.email),
    ])];
  }

  async updateGroupUserPermissions(
    recipientGroupId: string,
    userId: string,
    permissions: {
      canApproveFromPending?: boolean;
      canRejectFromPending?: boolean;
      canActivateSep?: boolean;
      canSendPdf?: boolean;
    },
    actor?: { role: UserRole; distributionId?: string | null },
  ) {
    const group = await this.assertGroupAccess(recipientGroupId, actor);
    if (group.type !== RecipientGroupType.APPROVAL) {
      throw new BadRequestException(
        'Granularne permisije su podržane samo za APPROVAL grupe.',
      );
    }

    const existing = await this.prisma.recipientGroupUser.findUnique({
      where: {
        recipientGroupId_userId: { recipientGroupId, userId },
      },
    });
    if (!existing) {
      throw new BadRequestException('Korisnik nije član ove grupe.');
    }

    return this.prisma.recipientGroupUser.update({
      where: {
        recipientGroupId_userId: { recipientGroupId, userId },
      },
      data: {
        ...(permissions.canApproveFromPending !== undefined && {
          canApproveFromPending: permissions.canApproveFromPending,
        }),
        ...(permissions.canRejectFromPending !== undefined && {
          canRejectFromPending: permissions.canRejectFromPending,
        }),
        ...(permissions.canActivateSep !== undefined && {
          canActivateSep: permissions.canActivateSep,
        }),
        ...(permissions.canSendPdf !== undefined && {
          canSendPdf: permissions.canSendPdf,
        }),
      },
    });
  }
}
