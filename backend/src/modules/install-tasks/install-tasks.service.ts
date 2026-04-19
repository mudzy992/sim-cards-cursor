import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InstallTaskStatus, MeterSimCardState, UserRole } from '@prisma/client'
import { scopeWhere, type ScopeContext } from 'src/common/utils/scope-filter.util'
import { PrismaService } from 'src/prisma/prisma.service'
import { ActivityLogService } from '../activity-log/activity-log.service'
import { InstallationRecordsService } from '../installation-records/installation-records.service'
import { SimCardsService } from '../sim-cards/sim-cards.service'
import { CreateInstallTaskDto } from './dto/create-install-task.dto'
import { CompleteInstallTaskDto } from './dto/complete-install-task.dto'

@Injectable()
export class InstallTasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogService: ActivityLogService,
    private readonly installationRecordsService: InstallationRecordsService,
    private readonly simCardsService: SimCardsService,
  ) {}

  async create(
    dto: CreateInstallTaskDto,
    createdById: string,
    scope: ScopeContext | null,
    ipAddress?: string,
  ) {
    const scopeClause = scopeWhere(scope, { branchIdField: 'branchId' })
    const meter = await this.prisma.meter.findFirst({
      where: {
        id: dto.meterId,
        ...(scopeClause ? { AND: [scopeClause] } : {}),
      },
      select: {
        id: true,
        branchId: true,
        simCardId: true,
        simCardState: true,
      },
    })
    if (!meter) {
      throw new BadRequestException('Brojilo nije pronađeno.')
    }
    if (meter.simCardState !== MeterSimCardState.NO_SIM || meter.simCardId) {
      throw new BadRequestException('Zadatak ugradnje SIM-a se može kreirati samo za brojilo bez SIM kartice.')
    }
    if (scope?.role === UserRole.USER) {
      const isModerator = await this.prisma.branchModerator.findUnique({
        where: {
          userId_branchId: {
            userId: createdById,
            branchId: meter.branchId ?? '',
          },
        },
        select: { id: true },
      })
      if (!isModerator) {
        throw new BadRequestException('Samo moderator podružnice može kreirati ovaj zadatak.')
      }
    }

    const assignedTo = await this.prisma.user.findUnique({
      where: { id: dto.assignedToId },
      include: {
        branch: { select: { distributionId: true } },
      },
    })
    if (!assignedTo) {
      throw new BadRequestException('Operator nije pronađen.')
    }
    if (assignedTo.role !== UserRole.USER) {
      throw new BadRequestException('Zadatak se može dodijeliti samo operatoru.')
    }
    if (scope?.role === UserRole.DIST_ADMIN && scope.distributionId) {
      const opDistributionId = assignedTo.distributionId ?? assignedTo.branch?.distributionId
      if (opDistributionId !== scope.distributionId) {
        throw new BadRequestException('Možete dodijeliti zadatak samo operatorima iz svoje distribucije.')
      }
    }

    const task = await this.prisma.installTask.create({
      data: {
        meterId: dto.meterId,
        assignedToId: dto.assignedToId,
        createdById,
        notes: dto.notes,
      },
      include: {
        meter: { include: { meterTypeDefinition: true, simCard: true } },
        assignedTo: true,
        createdBy: true,
      },
    })

    await this.activityLogService.log({
      userId: createdById,
      action: 'CREATE',
      entity: 'install_task',
      entityId: task.id,
      details: { meterId: dto.meterId, assignedToId: dto.assignedToId },
      ipAddress,
    })

    return task
  }

  async findMy(assignedToId: string, status?: InstallTaskStatus, scope?: ScopeContext | null) {
    const scopeClause = scopeWhere(scope, { viaMeter: true })
    return this.prisma.installTask.findMany({
      where: {
        assignedToId,
        ...(status ? { status } : {}),
        ...(scopeClause ? { AND: [scopeClause] } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        meter: { include: { meterTypeDefinition: true, simCard: true } },
        assignedTo: true,
        createdBy: true,
        installationRecord: true,
      },
    })
  }

  async updateStatus(id: string, status: InstallTaskStatus, userId: string, ipAddress?: string) {
    if (status === InstallTaskStatus.COMPLETED) {
      throw new BadRequestException('Završetak zadatka ide preko POST /install-tasks/:id/complete.')
    }
    const task = await this.prisma.installTask.findUnique({ where: { id } })
    if (!task) {
      throw new NotFoundException('Zadatak ugradnje nije pronađen.')
    }
    if (task.assignedToId !== userId) {
      throw new BadRequestException('Samo operator kojem je zadatak dodijeljen može ažurirati status.')
    }

    const updated = await this.prisma.installTask.update({
      where: { id },
      data: { status },
      include: {
        meter: { include: { meterTypeDefinition: true, simCard: true } },
        assignedTo: true,
        createdBy: true,
        installationRecord: true,
      },
    })

    await this.activityLogService.log({
      userId,
      action: 'UPDATE',
      entity: 'install_task',
      entityId: id,
      details: { status },
      ipAddress,
    })

    return updated
  }

  async complete(
    id: string,
    dto: CompleteInstallTaskDto,
    userId: string,
    scope?: ScopeContext | null,
    ipAddress?: string,
  ) {
    const scopeClause = scopeWhere(scope, { viaMeter: true })
    const task = await this.prisma.installTask.findFirst({
      where: {
        id,
        assignedToId: userId,
        ...(scopeClause ? { AND: [scopeClause] } : {}),
      },
      include: {
        meter: { select: { id: true, simCardId: true, simCardState: true } },
      },
    })
    if (!task) {
      throw new NotFoundException('Zadatak ugradnje nije pronađen.')
    }
    if (task.status === InstallTaskStatus.COMPLETED) {
      return this.prisma.installTask.findUniqueOrThrow({
        where: { id: task.id },
        include: {
          meter: { include: { meterTypeDefinition: true, simCard: true } },
          assignedTo: true,
          createdBy: true,
          installationRecord: true,
        },
      })
    }
    if (task.status !== InstallTaskStatus.IN_PROGRESS) {
      throw new BadRequestException('Zadatak mora biti u statusu U toku da bi se završio.')
    }
    if (task.meter.simCardState !== MeterSimCardState.NO_SIM || task.meter.simCardId) {
      throw new BadRequestException('Brojilo više nije u stanju NO_SIM; zadatak se ne može završiti ovim tokom.')
    }

    await this.simCardsService.claim(
      dto.simCardId,
      userId,
      ipAddress ?? '',
      scope ?? null,
    )

    const record = await this.installationRecordsService.create(
      {
        meterId: task.meter.id,
        simCardId: dto.simCardId,
        installedById: userId,
        notes: dto.recordNotes,
      },
      { userId, ipAddress },
    )

    const updated = await this.prisma.installTask.update({
      where: { id: task.id },
      data: {
        status: InstallTaskStatus.COMPLETED,
        completedAt: new Date(),
        installationRecordId: record.id,
      },
      include: {
        meter: { include: { meterTypeDefinition: true, simCard: true } },
        assignedTo: true,
        createdBy: true,
        installationRecord: true,
      },
    })

    await this.activityLogService.log({
      userId,
      action: 'UPDATE',
      entity: 'install_task',
      entityId: id,
      details: { status: InstallTaskStatus.COMPLETED, installationRecordId: record.id },
      ipAddress,
    })

    return updated
  }
}

