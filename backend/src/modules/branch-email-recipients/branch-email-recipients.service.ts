import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { UserRole } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { CreateBranchEmailRecipientDto } from './dto/create-branch-email-recipient.dto'
import { UpdateBranchEmailRecipientDto } from './dto/update-branch-email-recipient.dto'

type Actor = { role: UserRole; distributionId: string | null }

@Injectable()
export class BranchEmailRecipientsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBranchEmailRecipientDto, actor: Actor) {
    const branch = await this.ensureBranchExists(dto.branchId)
    this.assertBranchInScope(branch.distributionId, actor)

    return this.prisma.branchEmailRecipient.create({
      data: {
        branchId: dto.branchId,
        email: dto.email.trim().toLowerCase(),
        label: dto.label ?? null,
      },
      include: {
        branch: { select: { id: true, name: true, code: true } },
      },
    })
  }

  async update(id: string, dto: UpdateBranchEmailRecipientDto, actor: Actor) {
    const recipient = await this.findOrThrow(id)
    const branch = await this.ensureBranchExists(recipient.branchId)
    this.assertBranchInScope(branch.distributionId, actor)

    return this.prisma.branchEmailRecipient.update({
      where: { id },
      data: {
        ...(dto.email !== undefined ? { email: dto.email.trim().toLowerCase() } : {}),
        ...(dto.label !== undefined ? { label: dto.label } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: {
        branch: { select: { id: true, name: true, code: true } },
      },
    })
  }

  async remove(id: string, actor: Actor) {
    const recipient = await this.findOrThrow(id)
    const branch = await this.ensureBranchExists(recipient.branchId)
    this.assertBranchInScope(branch.distributionId, actor)

    return this.prisma.branchEmailRecipient.delete({ where: { id } })
  }

  async findByBranch(branchId: string, actor: Actor) {
    const branch = await this.ensureBranchExists(branchId)
    this.assertBranchInScope(branch.distributionId, actor)

    return this.prisma.branchEmailRecipient.findMany({
      where: { branchId },
      include: {
        branch: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findAll(actor: Actor) {
    const where =
      actor.role === UserRole.DIST_ADMIN && actor.distributionId
        ? { branch: { distributionId: actor.distributionId } }
        : {}

    return this.prisma.branchEmailRecipient.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true, code: true, distributionId: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  private assertBranchInScope(branchDistributionId: string, actor: Actor) {
    if (actor.role === UserRole.SYSTEM_ADMIN) return
    if (actor.role === UserRole.DIST_ADMIN) {
      if (!actor.distributionId || branchDistributionId !== actor.distributionId) {
        throw new ForbiddenException('Branch is outside your distribution scope')
      }
      return
    }
    throw new ForbiddenException('Insufficient permissions')
  }

  private async findOrThrow(id: string) {
    const recipient = await this.prisma.branchEmailRecipient.findUnique({
      where: { id },
    })
    if (!recipient) {
      throw new NotFoundException('Branch email recipient not found')
    }
    return recipient
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
