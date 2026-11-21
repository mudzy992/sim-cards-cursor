import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import {
  InstallTaskStatus,
  MeterSimCardState,
  MeterStatus,
  SimCardStatus,
  UserRole,
  UserStatus,
} from '@prisma/client'
import { scopeWhere, type ScopeContext } from 'src/common/utils/scope-filter.util'
import { SAFE_USER_SELECT } from 'src/common/utils/safe-user-select'
import { PrismaService } from 'src/prisma/prisma.service'
import { ActivityLogService } from '../activity-log/activity-log.service'
import { InstallationRecordsService } from '../installation-records/installation-records.service'
import { MeterTypeFieldsService } from '../meter-type-definitions/meter-type-fields.service'
import { NotificationsService } from '../notifications/notifications.service'
import { SimCardsService } from '../sim-cards/sim-cards.service'
import { CreateInstallTaskDto } from './dto/create-install-task.dto'
import { CompleteInstallTaskDto } from './dto/complete-install-task.dto'
import { InstallTaskFilterDto } from './dto/install-task-filter.dto'
import { assertMeterYearsPairIfPartial } from 'src/common/utils/meter-years.util'
import { Prisma, type User } from '@prisma/client'
import { ErrorCodes } from 'src/common/constants/error-codes'

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
      throw new BadRequestException({
        message: 'Brojilo nije pronađeno.',
        code: ErrorCodes.METER_NOT_FOUND,
      })
    }
    if (meter.hasOpenInstallTask) {
      throw new BadRequestException({
        message: 'Za ovo brojilo već postoji aktivan nalog za ugradnju SIM-a.',
        code: ErrorCodes.INSTALL_TASK_ALREADY_ACTIVE,
      })
    }
    if (meter.simCardState !== MeterSimCardState.NO_SIM || meter.simCardId) {
      throw new BadRequestException({
        message: 'Zadatak ugradnje SIM-a se može kreirati samo za brojilo bez SIM kartice.',
        code: ErrorCodes.INSTALL_TASK_METER_HAS_SIM,
      })
    }
    if (meter.status !== MeterStatus.ACTIVE) {
      throw new BadRequestException({
        message: 'Zadatak ugradnje se ne može kreirati za brojilo koje nije aktivno.',
        code: ErrorCodes.INSTALL_TASK_METER_INACTIVE,
      })
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
      throw new BadRequestException({
        message: 'Operator nije pronađen.',
        code: ErrorCodes.TASK_OPERATOR_NOT_FOUND,
      })
    }
    if (assignedTo.role !== UserRole.USER) {
      throw new BadRequestException({
        message: 'Zadatak se može dodijeliti samo operatoru.',
        code: ErrorCodes.TASK_ASSIGNEE_NOT_OPERATOR,
      })
    }
    if (assignedTo.status && assignedTo.status !== UserStatus.ACTIVE) {
      throw new BadRequestException('Zadatak se može dodijeliti samo aktivnom operatoru.')
    }
    if (scope && scope.role === UserRole.USER) {
      if (!meter.branchId || assignedTo.branchId !== meter.branchId) {
        throw new BadRequestException(
          'Možete dodijeliti zadatak samo operatoru iz iste podružnice kao brojilo.',
        )
      }
    }
    if (scope && scope.role === UserRole.DIST_ADMIN && scope.distributionId) {
      const opDistributionId = assignedTo.distributionId ?? assignedTo.branch?.distributionId
      if (opDistributionId !== scope.distributionId) {
        throw new BadRequestException({
          message: 'Možete dodijeliti zadatak samo operatorima iz svoje distribucije.',
          code: ErrorCodes.TASK_ASSIGNEE_OUTSIDE_DISTRIBUTION,
        })
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
          assignedTo: { select: SAFE_USER_SELECT },
          createdBy: { select: SAFE_USER_SELECT },
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

  async findAll(
    filter: InstallTaskFilterDto,
    userId: string,
    scope?: ScopeContext | null,
  ) {
    let moderatorWhere: Record<string, unknown> | undefined
    if (scope?.role === UserRole.USER) {
      let branchIds = scope.branchModeratorBranchIds ?? []
      if (branchIds.length === 0 && this.prisma.branchModerator?.findMany) {
        const moderated = await this.prisma.branchModerator.findMany({
          where: { userId },
          select: { branchId: true },
        })
        branchIds = moderated.map((m) => m.branchId)
      }
      if (branchIds.length === 0) {
        throw new ForbiddenException(
          'Samo administratori i moderatori podružnica mogu pregledati listu zadataka.',
        )
      }
      moderatorWhere = { meter: { branchId: { in: branchIds } } }
    }

    const { page = 1, limit = 20, status, unassignedOnly, branchId, search } = filter
    const skip = (page - 1) * limit
    const scopeClause = moderatorWhere ? undefined : scopeWhere(scope, { viaMeter: true })
    const andClauses: Record<string, unknown>[] = []
    if (scopeClause) andClauses.push(scopeClause)
    if (moderatorWhere) andClauses.push(moderatorWhere)
    if (branchId) andClauses.push({ meter: { branchId } })
    if (search?.trim()) {
      const q = search.trim()
      andClauses.push({
        OR: [
          { meter: { serialNumber: { contains: q, mode: 'insensitive' } } },
          { assignedTo: { firstName: { contains: q, mode: 'insensitive' } } },
          { assignedTo: { lastName: { contains: q, mode: 'insensitive' } } },
        ],
      })
    }

    const where: Prisma.InstallTaskWhereInput = {
      ...(status ? { status } : {}),
      ...(unassignedOnly ? { assignedToId: null } : {}),
      ...(andClauses.length ? { AND: andClauses as Prisma.InstallTaskWhereInput[] } : {}),
    }

    const [items, total] = await Promise.all([
      this.prisma.installTask.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          meter: { include: { meterTypeDefinition: true, simCard: true } },
          assignedTo: { select: SAFE_USER_SELECT },
          createdBy: { select: SAFE_USER_SELECT },
          installationRecord: true,
        },
      }),
      this.prisma.installTask.count({ where }),
    ])

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
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
        assignedTo: { select: SAFE_USER_SELECT },
        createdBy: { select: SAFE_USER_SELECT },
        installationRecord: true,
      },
    })
  }

  async updateStatus(
    id: string,
    status: InstallTaskStatus,
    userId: string,
    ipAddress?: string,
    scope?: ScopeContext | null,
  ) {
    if (status === InstallTaskStatus.COMPLETED) {
      throw new BadRequestException('Završetak zadatka ide preko POST /install-tasks/:id/complete.')
    }
    if (status === InstallTaskStatus.CANCELLED) {
      throw new BadRequestException('Operator ne može otkazati nalog. Otkazivanje radi inicijator naloga.')
    }
    const scopeClause = scope ? scopeWhere(scope, { viaMeter: true }) : undefined
    const task = scopeClause
      ? await this.prisma.installTask.findFirst({
          where: { id, AND: [scopeClause] },
          include: { meter: { select: { id: true, serialNumber: true } } },
        })
      : await this.prisma.installTask.findUnique({
          where: { id },
          include: { meter: { select: { id: true, serialNumber: true } } },
        })
    if (!task) {
      throw new NotFoundException({
        message: 'Zadatak ugradnje nije pronađen.',
        code: ErrorCodes.INSTALL_TASK_NOT_FOUND,
      })
    }
    if (task.assignedToId !== userId) {
      throw new BadRequestException({
        message: 'Samo operator kojem je zadatak dodijeljen može ažurirati status.',
        code: ErrorCodes.TASK_ONLY_ASSIGNEE_CAN_UPDATE,
      })
    }
    if (task.status === InstallTaskStatus.COMPLETED) {
      throw new BadRequestException({
        message: 'Nalog je već završen.',
        code: ErrorCodes.INSTALL_TASK_ALREADY_COMPLETED,
      })
    }
    if (task.status === InstallTaskStatus.CANCELLED) {
      throw new BadRequestException({
        message: 'Nalog je otkazan i ne može se mijenjati.',
        code: ErrorCodes.INSTALL_TASK_ALREADY_CANCELLED,
      })
    }
    const allowed =
      (task.status === InstallTaskStatus.PENDING && status === InstallTaskStatus.IN_PROGRESS) ||
      (task.status === InstallTaskStatus.IN_PROGRESS && status === InstallTaskStatus.PENDING)
    if (!allowed) {
      throw new BadRequestException('Dozvoljeno je samo: započni nalog ili vrati nalog inicijatoru.')
    }

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
    }

    const isReturnToInitiator =
      task.status === InstallTaskStatus.IN_PROGRESS && status === InstallTaskStatus.PENDING

    const updated = await this.prisma.installTask.update({
      where: { id },
      data: { status, ...(isReturnToInitiator ? { assignedToId: null } : {}) },
      include: {
        meter: { include: { meterTypeDefinition: true, simCard: true } },
        assignedTo: { select: SAFE_USER_SELECT },
        createdBy: { select: SAFE_USER_SELECT },
        installationRecord: true,
      },
    })

    await this.prisma.meter.update({
      where: { id: task.meterId },
      data: { hasOpenInstallTask: true },
    })

    await this.activityLogService.log({
      userId,
      action: 'UPDATE',
      entity: 'install_task',
      entityId: id,
      details: { status, ...(isReturnToInitiator ? { returnedToInitiator: true } : {}) },
      ipAddress,
    })

    await this.notificationsService.create({
      userId: task.createdById,
      title: 'Status zadatka ugradnje ažuriran',
      message: `Zadatak ugradnje za brojilo ${task.meter?.serialNumber ?? task.meterId} je promijenjen na ${status}.`,
      type: 'INSTALL_TASK_STATUS_UPDATED',
      link: `/meters/${task.meterId}`,
    })

    return updated
  }

  async cancel(id: string, actor: User, ipAddress?: string, scope?: ScopeContext | null) {
    const scopeClause = scope ? scopeWhere(scope, { viaMeter: true }) : undefined
    const task = scopeClause
      ? await this.prisma.installTask.findFirst({
          where: { id, AND: [scopeClause] },
          include: { meter: { select: { id: true, serialNumber: true } } },
        })
      : await this.prisma.installTask.findUnique({
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
        assignedTo: { select: SAFE_USER_SELECT },
        createdBy: { select: SAFE_USER_SELECT },
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
    const scopeClause = scope ? scopeWhere(scope, { viaMeter: true }) : undefined
    const task = scopeClause
      ? await this.prisma.installTask.findFirst({
          where: { id, AND: [scopeClause] },
          include: { meter: { select: { id: true, serialNumber: true, branchId: true } } },
        })
      : await this.prisma.installTask.findUnique({
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
    if (assignedTo.status && assignedTo.status !== UserStatus.ACTIVE) {
      throw new BadRequestException('Nalog se može dodijeliti samo aktivnom operatoru.')
    }
    if (scope && scope.role === UserRole.USER) {
      if (!task.meter?.branchId || assignedTo.branchId !== task.meter.branchId) {
        throw new BadRequestException(
          'Možete dodijeliti nalog samo operatoru iz iste podružnice kao brojilo.',
        )
      }
    }
    if (scope && scope.role === UserRole.DIST_ADMIN && scope.distributionId) {
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
        assignedTo: { select: SAFE_USER_SELECT },
        createdBy: { select: SAFE_USER_SELECT },
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
            branch: { select: { distributionId: true } },
          },
        },
      },
    })
    if (!task) {
      throw new NotFoundException({
        message: 'Zadatak ugradnje nije pronađen.',
        code: ErrorCodes.INSTALL_TASK_NOT_FOUND,
      })
    }
    if (task.status === InstallTaskStatus.COMPLETED) {
      return this.prisma.installTask.findUniqueOrThrow({
        where: { id: task.id },
        include: {
          meter: { include: { meterTypeDefinition: true, simCard: true } },
          assignedTo: { select: SAFE_USER_SELECT },
          createdBy: { select: SAFE_USER_SELECT },
          installationRecord: true,
        },
      })
    }
    if (task.status !== InstallTaskStatus.IN_PROGRESS) {
      throw new BadRequestException({
        message: 'Zadatak mora biti u statusu U toku da bi se završio.',
        code: ErrorCodes.INSTALL_TASK_MUST_BE_IN_PROGRESS,
      })
    }

    const clientRequestId = `install-task:${task.id}`

    // Recovery path: if an earlier attempt already created the installation record for this task
    // before crashing prior to updating the task row, finalize task closure idempotently.
    if (
      task.meter.simCardId === dto.simCardId &&
      this.prisma.installationRecord?.findUnique
    ) {
      const existingRecord = await this.prisma.installationRecord.findUnique({
        where: { clientRequestId },
        select: { id: true },
      })
      if (existingRecord) {
        return this.finalizeInstallTaskCompletion(
          task.id,
          task.meter.id,
          existingRecord.id,
          userId,
          ipAddress,
        )
      }
    }

    if (task.meter.simCardState !== MeterSimCardState.NO_SIM || task.meter.simCardId) {
      throw new BadRequestException({
        message: 'Brojilo više nije u stanju NO_SIM; zadatak se ne može završiti ovim tokom.',
        code: ErrorCodes.INSTALL_TASK_METER_HAS_SIM,
      })
    }
    if (task.meter.status !== MeterStatus.ACTIVE) {
      throw new BadRequestException({
        message: 'Brojilo nije aktivno; ugradnja SIM-a nije dozvoljena.',
        code: ErrorCodes.INSTALL_TASK_METER_INACTIVE,
      })
    }

    // Pre-validate SIM card distribution and availability before any state mutation
    if (this.prisma.simCard?.findFirst) {
      const simScopeClause = scope ? scopeWhere(scope, { viaShipment: true }) : undefined
      const sim = await this.prisma.simCard.findFirst({
        where: {
          id: dto.simCardId,
          ...(simScopeClause ? { AND: [simScopeClause] } : {}),
        },
        select: {
          id: true,
          status: true,
          assignedToId: true,
          shipment: { select: { distributionId: true } },
          meter: { select: { id: true } },
        },
      })
      if (!sim) {
        throw new BadRequestException('SIM kartica nije pronađena ili nije u vašem opsegu.')
      }
      if (sim.meter) {
        throw new BadRequestException('SIM kartica je već vezana za brojilo.')
      }
      const simUsable =
        sim.status === SimCardStatus.AVAILABLE ||
        (sim.status === SimCardStatus.ASSIGNED && sim.assignedToId === userId)
      if (!simUsable) {
        throw new BadRequestException('SIM kartica nije dostupna za ugradnju.')
      }
      const meterDistId = task.meter.branch?.distributionId ?? null
      if (
        meterDistId &&
        sim.shipment?.distributionId &&
        sim.shipment.distributionId !== meterDistId
      ) {
        throw new BadRequestException(
          'SIM kartica mora pripadati istoj distribuciji kao podružnica brojila.',
        )
      }
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
        photos: dto.photos,
        clientRequestId,
      },
      {
        userId,
        ipAddress,
        role: scope?.role,
        distributionId: scope?.distributionId ?? null,
        branchId: scope?.branchId ?? null,
        branchModeratorBranchIds: scope?.branchModeratorBranchIds ?? [],
      },
    )

    return this.finalizeInstallTaskCompletion(
      task.id,
      task.meter.id,
      record.id,
      userId,
      ipAddress,
    )
  }

  private async finalizeInstallTaskCompletion(
    taskId: string,
    meterId: string,
    recordId: string,
    userId: string,
    ipAddress?: string,
  ) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const transitioned = await tx.installTask.updateMany({
        where: { id: taskId, status: InstallTaskStatus.IN_PROGRESS },
        data: {
          status: InstallTaskStatus.COMPLETED,
          completedAt: new Date(),
          installationRecordId: recordId,
        },
      })
      if (transitioned.count === 0) {
        const alreadyClosed = tx.installTask.findUnique
          ? await tx.installTask.findUnique({
              where: { id: taskId },
              select: { status: true, installationRecordId: true },
            })
          : null
        if (
          !alreadyClosed ||
          alreadyClosed.status !== InstallTaskStatus.COMPLETED ||
          alreadyClosed.installationRecordId !== recordId
        ) {
          throw new BadRequestException('Zadatak je u međuvremenu već završen ili promijenjen.')
        }
      }
      await tx.meter.update({
        where: { id: meterId },
        data: { hasOpenInstallTask: false },
      })
      return tx.installTask.findUniqueOrThrow({
        where: { id: taskId },
        include: {
          meter: { include: { meterTypeDefinition: true, simCard: true } },
          assignedTo: { select: SAFE_USER_SELECT },
          createdBy: { select: SAFE_USER_SELECT },
          installationRecord: true,
        },
      })
    })

    await this.activityLogService.log({
      userId,
      action: 'UPDATE',
      entity: 'install_task',
      entityId: taskId,
      details: { status: InstallTaskStatus.COMPLETED, installationRecordId: recordId },
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

