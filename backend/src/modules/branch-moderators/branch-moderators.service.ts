import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { UserRole } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { AssignBranchModeratorDto } from './dto/assign-branch-moderator.dto'

@Injectable()
export class BranchModeratorsService {
  constructor(private readonly prisma: PrismaService) {}

  async assign(dto: AssignBranchModeratorDto, actor: { role: UserRole; distributionId: string | null }) {
    await this.ensureUserExists(dto.userId)
    const branch = await this.ensureBranchExists(dto.branchId)
    this.assertBranchInScope(branch.distributionId, actor)

    const targetUser = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { role: true },
    })
    if (targetUser?.role !== UserRole.USER) {
      throw new ConflictException('Only users with USER role can be branch moderators')
    }

    const existing = await this.prisma.branchModerator.findUnique({
      where: { userId_branchId: { userId: dto.userId, branchId: dto.branchId } },
    })
    if (existing) {
      throw new ConflictException('User is already a moderator for this branch')
    }

    return this.prisma.branchModerator.create({
      data: { userId: dto.userId, branchId: dto.branchId },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        branch: { select: { id: true, name: true, code: true, distributionId: true } },
      },
    })
  }

  async remove(id: string, actor: { role: UserRole; distributionId: string | null }) {
    const entry = await this.prisma.branchModerator.findUnique({
      where: { id },
      include: { branch: { select: { distributionId: true } } },
    })
    if (!entry) {
      throw new NotFoundException('Branch moderator assignment not found')
    }
    this.assertBranchInScope(entry.branch.distributionId, actor)

    return this.prisma.branchModerator.delete({ where: { id } })
  }

  async findByBranch(branchId: string, actor: { role: UserRole; distributionId: string | null }) {
    const branch = await this.ensureBranchExists(branchId)
    this.assertBranchInScope(branch.distributionId, actor)

    return this.prisma.branchModerator.findMany({
      where: { branchId },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        branch: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findByUser(userId: string) {
    return this.prisma.branchModerator.findMany({
      where: { userId },
      include: {
        branch: {
          select: { id: true, name: true, code: true, distributionId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findAll(actor: { role: UserRole; distributionId: string | null }) {
    const where = actor.role === UserRole.DIST_ADMIN && actor.distributionId
      ? { branch: { distributionId: actor.distributionId } }
      : {}

    return this.prisma.branchModerator.findMany({
      where,
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        branch: { select: { id: true, name: true, code: true, distributionId: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  private assertBranchInScope(
    branchDistributionId: string,
    actor: { role: UserRole; distributionId: string | null },
  ) {
    if (actor.role === UserRole.SYSTEM_ADMIN) return
    if (actor.role === UserRole.DIST_ADMIN) {
      if (!actor.distributionId || branchDistributionId !== actor.distributionId) {
        throw new ForbiddenException('Branch is outside your distribution scope')
      }
      return
    }
    throw new ForbiddenException('Insufficient permissions')
  }

  private async ensureUserExists(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    })
    if (!user) {
      throw new NotFoundException('User not found')
    }
    return user
  }

  private async ensureBranchExists(branchId: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, distributionId: true },
    })
    if (!branch) {
      throw new NotFoundException('Branch not found')
    }
    return branch
  }
}
