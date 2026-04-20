import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InstallTaskStatus, MeterSimCardState, MeterStatus, UserRole } from '@prisma/client'
import { scopeWhere, type ScopeContext } from 'src/common/utils/scope-filter.util'
import { PrismaService } from 'src/prisma/prisma.service'
import { ActivityLogService } from '../activity-log/activity-log.service'
import { InstallationRecordsService } from '../installation-records/installation-records.service'
import { MeterTypeFieldsService } from '../meter-type-definitions/meter-type-fields.service'
import { NotificationsService } from '../notifications/notifications.service'
import { SimCardsService } from '../sim-cards/sim-cards.service'
import { CreateInstallTaskDto } from './dto/create-install-task.dto'
import { CompleteInstallTaskDto } from './dto/complete-install-task.dto'
import { assertMeterYearsPairIfPartial } from 'src/common/utils/meter-years.util'
import { Prisma, type User } from '@prisma/client'

@Injectable()
export class InstallTasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogService: ActivityLogService,
    private readonly installationRecordsService: InstallationRecordsService,
    private readonly meterTypeFieldsService: MeterTypeFieldsService,
    private readonly notificationsService: NotificationsService,
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
        status: true,
        hasOpenInstallTask: true,
      },
    })
    if (!meter) {
      throw new BadRequestException('Brojilo nije pronađeno.')
    }
    if (meter.hasOpenInstallTask) {
      throw new BadRequestException('Za ovo brojilo već postoji aktivan nalog za ugradnju SIM-a.')
    }
    if (meter.simCardState !== MeterSimCardState.NO_SIM || meter.simCardId) {
      throw new BadRequestException('Zadatak ugradnje SIM-a se može kreirati samo za brojilo bez SIM kartice.')
    }
    if (meter.status !== MeterStatus.ACTIVE) {
      throw new BadRequestException('Zadatak ugradnje se ne može kreirati za brojilo koje nije aktivno.')
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

    const task = await this.prisma.$transaction(async (tx) => {
      const lockResult = await tx.meter.updateMany({
        where: {
          id: dto.meterId,
          hasOpenInstallTask: false,
          simCardState: MeterSimCardState.NO_SIM,
          simCardId: null,
          status: MeterStatus.ACTIVE,
        },
        data: { hasOpenInstallTask: true },
      })
      if (lockResult.count !== 1) {
        throw new BadRequestException('Za ovo brojilo već postoji aktivan nalog za ugradnju SIM-a.')
      }
      return tx.installTask.create({
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
    })

    await this.activityLogService.log({
      userId: createdById,
      action: 'CREATE',
      entity: 'install_task',
      entityId: task.id,
      details: { meterId: dto.meterId, assignedToId: dto.assignedToId },
      ipAddress,
    })

    await this.notificationsService.create({
      userId: dto.assignedToId,
      title: 'Novi zadatak ugradnje SIM',
      message: `Dodijeljen vam je zadatak ugradnje SIM za brojilo ${task.meter?.serialNumber ?? dto.meterId}.`,
      type: 'INSTALL_TASK_ASSIGNED',
      link: `/meters/${dto.meterId}`,
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
    if (status === InstallTaskStatus.CANCELLED) {
      throw new BadRequestException('Operator ne može otkazati nalog. Otkazivanje radi inicijator naloga.')
    }
    const task = await this.prisma.installTask.findUnique({
      where: { id },
      include: { meter: { select: { id: true, serialNumber: true } } },
    })
    if (!task) {
      throw new NotFoundException('Zadatak ugradnje nije pronađen.')
    }
    if (task.assignedToId !== userId) {
      throw new BadRequestException('Samo operator kojem je zadatak dodijeljen može ažurirati status.')
    }
    if (task.status === InstallTaskStatus.COMPLETED) {
      throw new BadRequestException('Nalog je već završen.')
    }
    if (task.status === InstallTaskStatus.CANCELLED) {
      throw new BadRequestException('Nalog je otkazan i ne može se mijenjati.')
    }
    const allowed =
      (task.status === InstallTaskStatus.PENDING && status === InstallTaskStatus.IN_PROGRESS) ||
      (task.status === InstallTaskStatus.IN_PROGRESS && status === InstallTaskStatus.PENDING)
    if (!allowed) {
      throw new BadRequestException('Dozvoljeno je samo: započni nalog ili vrati nalog inicijatoru.')
    }

    const isReturnToInitiator =
      task.status === InstallTaskStatus.IN_PROGRESS && status === InstallTaskStatus.PENDING

    const updated = await this.prisma.installTask.update({
      where: { id },
      data: { status, ...(isReturnToInitiator ? { assignedToId: null } : {}) },
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
      details: { status, ...(isReturnToInitiator ? { returnedToInitiator: true } : {}) },
      ipAddress,
    })

    if (status === InstallTaskStatus.PENDING || status === InstallTaskStatus.IN_PROGRESS) {
      const otherOpen = await this.prisma.installTask.findFirst({
        where: {
          meterId: task.meterId,
          status: { in: [InstallTaskStatus.PENDING, InstallTaskStatus.IN_PROGRESS] },
          NOT: { id: task.id },
        },
        select: { id: true },
      })
      if (otherOpen) {
        throw new BadRequestException('Za ovo brojilo već postoji aktivan nalog za ugradnju SIM-a.')
      }
      await this.prisma.meter.update({
        where: { id: task.meterId },
        data: { hasOpenInstallTask: true },
      })
    }

    await this.notificationsService.create({
      userId: task.createdById,
      title: 'Status zadatka ugradnje ažuriran',
      message: `Zadatak ugradnje za brojilo ${task.meter?.serialNumber ?? task.meterId} je promijenjen na ${status}.`,
      type: 'INSTALL_TASK_STATUS_UPDATED',
      link: `/meters/${task.meterId}`,
    })

    return updated
  }

  async cancel(id: string, actor: User, ipAddress?: string) {
    const task = await this.prisma.installTask.findUnique({
      where: { id },
      include: { meter: { select: { id: true, serialNumber: true } } },
    })
    if (!task) throw new NotFoundException('Zadatak ugradnje nije pronađen.')
    const canCancel =
      actor.role === UserRole.SYSTEM_ADMIN ||
      actor.role === UserRole.DIST_ADMIN ||
      task.createdById === actor.id
    if (!canCancel) {
      throw new BadRequestException('Samo inicijator naloga može otkazati nalog.')
    }
    if (task.status === InstallTaskStatus.COMPLETED) {
      throw new BadRequestException('Nalog je već završen i ne može se otkazati.')
    }
    const updated = await this.prisma.installTask.update({
      where: { id },
      data: { status: InstallTaskStatus.CANCELLED },
      include: {
        meter: { include: { meterTypeDefinition: true, simCard: true } },
        assignedTo: true,
        createdBy: true,
        installationRecord: true,
      },
    })
    await this.prisma.meter.update({
      where: { id: task.meterId },
      data: { hasOpenInstallTask: false },
    })
    await this.activityLogService.log({
      userId: actor.id,
      action: 'UPDATE',
      entity: 'install_task',
      entityId: id,
      details: { status: InstallTaskStatus.CANCELLED },
      ipAddress,
    })
    if (updated.assignedToId) {
      await this.notificationsService.create({
        userId: updated.assignedToId,
        title: 'Nalog ugradnje otkazan',
        message: `Nalog ugradnje za brojilo ${updated.meter?.serialNumber ?? updated.meterId} je otkazan.`,
        type: 'INSTALL_TASK_CANCELLED',
        link: `/meters/${updated.meterId}`,
      })
    }
    return updated
  }

  async reassign(
    id: string,
    assignedToId: string,
    actor: User,
    scope: ScopeContext | null,
    ipAddress?: string,
  ) {
    const task = await this.prisma.installTask.findUnique({
      where: { id },
      include: { meter: { select: { id: true, serialNumber: true, branchId: true } } },
    })
    if (!task) throw new NotFoundException('Zadatak ugradnje nije pronađen.')
    const canReassign =
      actor.role === UserRole.SYSTEM_ADMIN ||
      actor.role === UserRole.DIST_ADMIN ||
      task.createdById === actor.id
    if (!canReassign) {
      throw new BadRequestException('Samo inicijator naloga može pre-dodijeliti nalog.')
    }
    if (task.status === InstallTaskStatus.COMPLETED) {
      throw new BadRequestException('Nalog je već završen i ne može se pre-dodijeliti.')
    }
    if (task.status === InstallTaskStatus.CANCELLED) {
      throw new BadRequestException('Nalog je otkazan i ne može se pre-dodijeliti.')
    }
    const assignedTo = await this.prisma.user.findUnique({
      where: { id: assignedToId },
      include: { branch: { select: { distributionId: true } } },
    })
    if (!assignedTo) throw new BadRequestException('Operator nije pronađen.')
    if (assignedTo.role !== UserRole.USER) {
      throw new BadRequestException('Nalog se može dodijeliti samo operatoru.')
    }
    if (scope?.role === UserRole.DIST_ADMIN && scope.distributionId) {
      const opDistributionId = assignedTo.distributionId ?? assignedTo.branch?.distributionId
      if (opDistributionId !== scope.distributionId) {
        throw new BadRequestException('Možete dodijeliti nalog samo operatorima iz svoje distribucije.')
      }
    }
    const updated = await this.prisma.installTask.update({
      where: { id },
      data: {
        assignedToId,
        status: InstallTaskStatus.PENDING,
      },
      include: {
        meter: { include: { meterTypeDefinition: true, simCard: true } },
        assignedTo: true,
        createdBy: true,
        installationRecord: true,
      },
    })
    await this.activityLogService.log({
      userId: actor.id,
      action: 'UPDATE',
      entity: 'install_task',
      entityId: id,
      details: { assignedToId, status: InstallTaskStatus.PENDING },
      ipAddress,
    })
    await this.notificationsService.create({
      userId: assignedToId,
      title: 'Novi zadatak ugradnje SIM',
      message: `Dodijeljen vam je zadatak ugradnje SIM za brojilo ${updated.meter?.serialNumber ?? updated.meterId}.`,
      type: 'INSTALL_TASK_ASSIGNED',
      link: `/meters/${updated.meterId}`,
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
        meter: {
          select: {
            id: true,
            status: true,
            simCardId: true,
            simCardState: true,
            meterTypeDefinitionId: true,
            year: true,
            calibrationYear: true,
            isDemountedFromLocation: true,
          },
        },
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
    if (task.meter.status !== MeterStatus.ACTIVE) {
      throw new BadRequestException('Brojilo nije aktivno; ugradnja SIM-a nije dozvoljena.')
    }

    const validatedDynamic = await this.meterTypeFieldsService.validateDynamicValues(
      task.meter.meterTypeDefinitionId,
      dto.dynamicFieldValues ?? null,
    )

    const meterUpdateData: Prisma.MeterUpdateInput = {
      ...(dto.calibrationYear !== undefined && { calibrationYear: dto.calibrationYear }),
      ...(dto.dynamicFieldValues !== undefined && {
        dynamicFieldValues:
          Object.keys(validatedDynamic).length > 0
            ? (validatedDynamic as Prisma.InputJsonValue)
            : Prisma.DbNull,
      }),
    }

    if (dto.calibrationYear !== undefined) {
      assertMeterYearsPairIfPartial(task.meter.year, dto.calibrationYear)
    }

    if (task.meter.isDemountedFromLocation) {
      const installationAddress = dto.installationAddress?.trim() ?? ''
      const city = dto.city?.trim() ?? ''
      const municipality = dto.municipality?.trim() ?? ''
      const measuringPoint = dto.measuringPoint?.trim() ?? ''
      if (!installationAddress || !city || !municipality || !measuringPoint) {
        throw new BadRequestException(
          'Brojilo je demontirano sa lokacije. Unesite lokaciju (adresa, grad, općina, mjerno mjesto).',
        )
      }
      meterUpdateData.installationAddress = installationAddress
      if (dto.installationDate) {
        meterUpdateData.installationDate = new Date(dto.installationDate)
      }
      meterUpdateData.city = city
      meterUpdateData.municipality = municipality
      meterUpdateData.measuringPoint = measuringPoint
      if (dto.latitude !== undefined) meterUpdateData.latitude = dto.latitude
      if (dto.longitude !== undefined) meterUpdateData.longitude = dto.longitude
      meterUpdateData.isDemountedFromLocation = false
    }

    await this.simCardsService.claim(dto.simCardId, userId, ipAddress ?? '', scope ?? null)

    if (Object.keys(meterUpdateData).length > 0) {
      await this.prisma.meter.update({
        where: { id: task.meter.id },
        data: meterUpdateData,
      })
    }

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

    await this.prisma.meter.update({
      where: { id: task.meter.id },
      data: { hasOpenInstallTask: false },
    })

    await this.activityLogService.log({
      userId,
      action: 'UPDATE',
      entity: 'install_task',
      entityId: id,
      details: { status: InstallTaskStatus.COMPLETED, installationRecordId: record.id },
      ipAddress,
    })

    await this.notificationsService.create({
      userId: updated.createdById,
      title: 'Završen zadatak ugradnje SIM',
      message: `Zadatak ugradnje za brojilo ${updated.meter?.serialNumber ?? updated.meterId} je završen.`,
      type: 'INSTALL_TASK_COMPLETED',
      link: `/meters/${updated.meterId}`,
    })

    return updated
  }
}

