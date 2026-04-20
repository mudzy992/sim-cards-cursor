import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { scopeWhere, ScopeContext } from 'src/common/utils/scope-filter.util';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateDemountTaskDto } from './dto/create-demount-task.dto';
import { CompleteDemountTaskDto } from './dto/complete-demount-task.dto';
import {
  DemountTaskStatus,
  DemountCompletionResolution,
  MeterDemountCategory,
  MeterSimCardState,
  MeterStatus,
  RemovedSimDisposition,
  SimCardStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { User } from '@prisma/client';

@Injectable()
export class DemountTasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogService: ActivityLogService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(
    dto: CreateDemountTaskDto,
    createdById: string,
    ipAddress?: string,
    scope?: ScopeContext | null,
  ) {
    const scopeClause = scopeWhere(scope, { branchIdField: 'branchId' });
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
        hasOpenDemountTask: true,
      },
    });
    if (!meter) {
      throw new BadRequestException('Brojilo nije pronađeno.');
    }
    if (meter.hasOpenDemountTask) {
      throw new BadRequestException('Za ovo brojilo već postoji aktivan nalog za demontažu.')
    }
    if (!meter.simCardId) {
      throw new BadRequestException('Brojilo nema ugradjenu SIM karticu.');
    }
    if (meter.simCardState !== MeterSimCardState.INSTALLED) {
      throw new BadRequestException('Zadatak demontaže se može kreirati samo za brojilo sa ugrađenom SIM karticom.')
    }
    if (meter.status !== MeterStatus.ACTIVE) {
      throw new BadRequestException('Zadatak demontaže se ne može kreirati za brojilo koje nije aktivno.')
    }
    const assignedTo = await this.prisma.user.findUnique({
      where: { id: dto.assignedToId },
      include: { branch: { select: { distributionId: true } }, distribution: { select: { id: true } } },
    });
    if (!assignedTo) {
      throw new BadRequestException('Operator nije pronađen.');
    }
    if (scope?.role === 'DIST_ADMIN' && scope.distributionId) {
      const opDistributionId = assignedTo.distributionId ?? assignedTo.branch?.distributionId;
      if (opDistributionId !== scope.distributionId) {
        throw new BadRequestException('Možete dodijeliti zadatak samo operatorima iz svoje distribucije.');
      }
    }

    const task = await this.prisma.$transaction(async (tx) => {
      const lockResult = await tx.meter.updateMany({
        where: {
          id: dto.meterId,
          hasOpenDemountTask: false,
          simCardState: MeterSimCardState.INSTALLED,
          simCardId: { not: null },
          status: MeterStatus.ACTIVE,
        },
        data: { hasOpenDemountTask: true },
      })
      if (lockResult.count !== 1) {
        throw new BadRequestException('Za ovo brojilo već postoji aktivan nalog za demontažu.')
      }
      return tx.demountTask.create({
        data: {
          meterId: dto.meterId,
          assignedToId: dto.assignedToId,
          createdById,
          notes: dto.notes,
          taskType: dto.taskType ?? undefined,
          requestedResolution: dto.requestedResolution,
          requestedReason: dto.requestedReason,
          requestedRemovedSimDisposition: dto.requestedRemovedSimDisposition as RemovedSimDisposition,
          requestedMeterDemountCategory:
            (dto.requestedMeterDemountCategory ?? null) as MeterDemountCategory | null,
        },
        include: {
          meter: { include: { simCard: true, meterTypeDefinition: true } },
          assignedTo: true,
          createdBy: true,
        },
      })
    })

    await this.activityLogService.log({
      userId: createdById,
      action: 'CREATE',
      entity: 'demount_task',
      entityId: task.id,
      details: { meterId: dto.meterId, assignedToId: dto.assignedToId, taskType: task.taskType },
      ipAddress,
    });

    await this.notificationsService.create({
      userId: dto.assignedToId,
      title: 'Novi zadatak demontaže',
      message: `Dodijeljen vam je zadatak demontaže za brojilo ${task.meter?.serialNumber ?? dto.meterId}.`,
      type: 'DEMOUNT_TASK_ASSIGNED',
      link: `/demount`,
    });

    return task;
  }

  async findMy(assignedToId: string, status?: DemountTaskStatus, scope?: ScopeContext | null) {
    const scopeClause = scopeWhere(scope, { viaMeter: true });
    return this.prisma.demountTask.findMany({
      where: {
        assignedToId,
        ...(status ? { status } : {}),
        ...(scopeClause ? { AND: [scopeClause] } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        meter: { include: { simCard: true, meterTypeDefinition: true } },
        assignedTo: true,
        createdBy: true,
      },
    });
  }

  async updateStatus(
    id: string,
    status: DemountTaskStatus,
    userId: string,
    ipAddress?: string,
  ) {
    if (status === DemountTaskStatus.COMPLETED) {
      throw new BadRequestException(
        'Završetak zadatka ide preko POST /demount-tasks/:id/complete sa rezolucijom i obrazloženjem.',
      );
    }
    if (status === DemountTaskStatus.CANCELLED) {
      throw new BadRequestException('Operator ne može otkazati nalog. Otkazivanje radi inicijator naloga.');
    }
    const task = await this.prisma.demountTask.findUnique({
      where: { id },
      include: { meter: { select: { id: true, serialNumber: true } } },
    });
    if (!task) {
      throw new NotFoundException('Zadatak demontaže nije pronađen.');
    }
    if (task.assignedToId !== userId) {
      throw new BadRequestException('Samo operator kojem je zadatak dodijeljen može ažurirati status.');
    }
    if (task.status === DemountTaskStatus.COMPLETED) {
      throw new BadRequestException('Nalog je već završen.');
    }
    if (task.status === DemountTaskStatus.CANCELLED) {
      throw new BadRequestException('Nalog je otkazan i ne može se mijenjati.');
    }
    const allowed =
      (task.status === DemountTaskStatus.PENDING && status === DemountTaskStatus.IN_PROGRESS) ||
      (task.status === DemountTaskStatus.IN_PROGRESS && status === DemountTaskStatus.PENDING);
    if (!allowed) {
      throw new BadRequestException('Dozvoljeno je samo: započni nalog ili vrati nalog inicijatoru.');
    }

    const updated = await this.prisma.demountTask.update({
      where: { id },
      data: {
        status,
      },
      include: {
        meter: { include: { simCard: true, meterTypeDefinition: true } },
        assignedTo: true,
        createdBy: true,
      },
    });

    await this.activityLogService.log({
      userId,
      action: 'UPDATE',
      entity: 'demount_task',
      entityId: id,
      details: { status },
      ipAddress,
    });

    await this.notificationsService.create({
      userId: task.createdById,
      title: 'Status zadatka demontaže ažuriran',
      message: `Zadatak demontaže za brojilo ${task.meter?.serialNumber ?? task.meterId} je promijenjen na ${status}.`,
      type: 'DEMOUNT_TASK_STATUS_UPDATED',
      link: `/meters/${task.meterId}`,
    });

    return updated;
  }

  async cancel(id: string, actor: User, ipAddress?: string) {
    const task = await this.prisma.demountTask.findUnique({
      where: { id },
      include: { meter: { select: { id: true, serialNumber: true } } },
    });
    if (!task) throw new NotFoundException('Zadatak demontaže nije pronađen.');
    const canCancel =
      actor.role === UserRole.SYSTEM_ADMIN ||
      actor.role === UserRole.DIST_ADMIN ||
      task.createdById === actor.id;
    if (!canCancel) {
      throw new BadRequestException('Samo inicijator naloga može otkazati nalog.');
    }
    if (task.status === DemountTaskStatus.COMPLETED) {
      throw new BadRequestException('Nalog je već završen i ne može se otkazati.');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const upd = await tx.demountTask.update({
        where: { id },
        data: { status: DemountTaskStatus.CANCELLED },
        include: {
          meter: { include: { simCard: true, meterTypeDefinition: true } },
          assignedTo: true,
          createdBy: true,
        },
      })
      await tx.meter.update({
        where: { id: upd.meterId },
        data: { hasOpenDemountTask: false },
      })
      return upd
    })
    await this.activityLogService.log({
      userId: actor.id,
      action: 'UPDATE',
      entity: 'demount_task',
      entityId: id,
      details: { status: DemountTaskStatus.CANCELLED },
      ipAddress,
    });
    await this.notificationsService.create({
      userId: updated.assignedToId,
      title: 'Nalog demontaže otkazan',
      message: `Nalog demontaže za brojilo ${updated.meter?.serialNumber ?? updated.meterId} je otkazan.`,
      type: 'DEMOUNT_TASK_CANCELLED',
      link: `/meters/${updated.meterId}`,
    });
    return updated;
  }

  async reassign(
    id: string,
    assignedToId: string,
    actor: User,
    scope: ScopeContext | null,
    ipAddress?: string,
  ) {
    const task = await this.prisma.demountTask.findUnique({
      where: { id },
      include: { meter: { select: { id: true, serialNumber: true, branchId: true } } },
    });
    if (!task) throw new NotFoundException('Zadatak demontaže nije pronađen.');
    const canReassign =
      actor.role === UserRole.SYSTEM_ADMIN ||
      actor.role === UserRole.DIST_ADMIN ||
      task.createdById === actor.id;
    if (!canReassign) {
      throw new BadRequestException('Samo inicijator naloga može pre-dodijeliti nalog.');
    }
    if (task.status === DemountTaskStatus.COMPLETED) {
      throw new BadRequestException('Nalog je već završen i ne može se pre-dodijeliti.');
    }
    if (task.status === DemountTaskStatus.CANCELLED) {
      throw new BadRequestException('Nalog je otkazan i ne može se pre-dodijeliti.');
    }
    const assignedTo = await this.prisma.user.findUnique({
      where: { id: assignedToId },
      include: { branch: { select: { distributionId: true } } },
    });
    if (!assignedTo) throw new BadRequestException('Operator nije pronađen.');
    if (assignedTo.role !== UserRole.USER) {
      throw new BadRequestException('Nalog se može dodijeliti samo operatoru.');
    }
    if (scope?.role === UserRole.DIST_ADMIN && scope.distributionId) {
      const opDistributionId = assignedTo.distributionId ?? assignedTo.branch?.distributionId;
      if (opDistributionId !== scope.distributionId) {
        throw new BadRequestException('Možete dodijeliti nalog samo operatorima iz svoje distribucije.');
      }
    }
    const updated = await this.prisma.demountTask.update({
      where: { id },
      data: {
        assignedToId,
        status: DemountTaskStatus.PENDING,
      },
      include: {
        meter: { include: { simCard: true, meterTypeDefinition: true } },
        assignedTo: true,
        createdBy: true,
      },
    });
    await this.activityLogService.log({
      userId: actor.id,
      action: 'UPDATE',
      entity: 'demount_task',
      entityId: id,
      details: { assignedToId, status: DemountTaskStatus.PENDING },
      ipAddress,
    });
    await this.notificationsService.create({
      userId: assignedToId,
      title: 'Novi zadatak demontaže',
      message: `Dodijeljen vam je zadatak demontaže za brojilo ${updated.meter?.serialNumber ?? updated.meterId}.`,
      type: 'DEMOUNT_TASK_ASSIGNED',
      link: `/meters/${updated.meterId}`,
    });
    return updated;
  }

  async complete(
    id: string,
    dto: CompleteDemountTaskDto,
    userId: string,
    ipAddress?: string,
    scope?: ScopeContext | null,
  ) {
    const scopeClause = scopeWhere(scope, { viaMeter: true });
    const task = await this.prisma.demountTask.findFirst({
      where: {
        id,
        assignedToId: userId,
        ...(scopeClause ? { AND: [scopeClause] } : {}),
      },
      include: {
        meter: {
          include: {
            simCard: true,
            branch: { select: { id: true, distributionId: true } },
          },
        },
      },
    });
    if (!task) {
      throw new NotFoundException('Zadatak demontaže nije pronađen.');
    }
    if (task.status === DemountTaskStatus.COMPLETED) {
      return this.prisma.demountTask.findUniqueOrThrow({
        where: { id },
        include: {
          meter: { include: { simCard: true, meterTypeDefinition: true } },
          assignedTo: true,
          createdBy: true,
        },
      })
    }
    if (task.status !== DemountTaskStatus.IN_PROGRESS) {
      throw new BadRequestException('Zadatak mora biti u statusu U toku da bi se završio wizardom.');
    }
    const meter = task.meter;
    const oldSimId = meter.simCardId;
    if (!oldSimId) {
      throw new BadRequestException('Brojilo više nema SIM karticu; zadatak se ne može završiti ovim tokom.');
    }

    const effectiveResolution = task.requestedResolution ?? dto.resolution
    const effectiveReason = task.requestedReason ?? dto.reason
    const effectiveRemovedSimDisposition =
      (task.requestedRemovedSimDisposition ?? dto.removedSimDisposition) as RemovedSimDisposition
    const effectiveMeterDemountCategory = (task.requestedMeterDemountCategory ??
      (dto.meterDemountCategory ?? null)) as MeterDemountCategory | null

    if (task.requestedResolution && dto.resolution !== task.requestedResolution) {
      throw new BadRequestException('Rezolucija je zaključana od strane inicijatora naloga.')
    }
    if (task.requestedReason && dto.reason !== task.requestedReason) {
      throw new BadRequestException('Obrazloženje je zaključano od strane inicijatora naloga.')
    }
    if (task.requestedRemovedSimDisposition && dto.removedSimDisposition !== task.requestedRemovedSimDisposition) {
      throw new BadRequestException('Ishod uklonjene SIM je zaključan od strane inicijatora naloga.')
    }
    if (
      task.requestedMeterDemountCategory &&
      (dto.meterDemountCategory ?? null) !== task.requestedMeterDemountCategory
    ) {
      throw new BadRequestException('Kategorija demontaže je zaključana od strane inicijatora naloga.')
    }

    const meterDistributionId = meter.branch?.distributionId ?? null;
    const oldSimRemoval = this.buildOldSimRemovalUpdate(
      effectiveRemovedSimDisposition as RemovedSimDisposition,
    );
    if (effectiveResolution === DemountCompletionResolution.REPLACE_SIM) {
      if (!dto.newSimCardId) {
        throw new BadRequestException('Za zamjenu SIM-a navedite novu SIM karticu (newSimCardId).');
      }
      if (dto.newSimCardId === oldSimId) {
        throw new BadRequestException('Nova SIM mora biti drugačija od trenutno ugrađene.');
      }
      await this.assertSimUsableForReplace(dto.newSimCardId, userId, meterDistributionId, scope);
      await this.prisma.$transaction(async (tx) => {
        await tx.meter.update({
          where: { id: meter.id },
          data: {
            simCardId: dto.newSimCardId,
            simCardState: MeterSimCardState.INSTALLED,
            noSimReason: null,
            hasOpenDemountTask: false,
          },
        });
        await tx.simCard.update({
          where: { id: oldSimId },
          data: oldSimRemoval,
        });
        await tx.simCard.update({
          where: { id: dto.newSimCardId },
          data: { status: SimCardStatus.INSTALLED },
        });
        await tx.demountTask.update({
          where: { id: task.id },
          data: {
            status: DemountTaskStatus.COMPLETED,
            completedAt: new Date(),
            completionResolution: effectiveResolution,
            completionReason: effectiveReason,
            removedSimDisposition: effectiveRemovedSimDisposition,
            meterDemountCategory: effectiveMeterDemountCategory,
          },
        });
      });
      const branchId = meter.branchId ?? undefined;
      await this.prisma.simEvent.create({
        data: {
          simCardId: oldSimId,
          type: 'DEMOUNTED',
          userId,
          branchId: branchId ?? null,
          metadata: {
            resolution: effectiveResolution,
            demountTaskId: task.id,
            replacedBySimCardId: dto.newSimCardId,
            removedSimDisposition: effectiveRemovedSimDisposition,
          } as Prisma.InputJsonValue,
        },
      });
      await this.prisma.simEvent.create({
        data: {
          simCardId: dto.newSimCardId,
          type: 'INSTALLED',
          userId,
          branchId: branchId ?? null,
          metadata: {
            resolution: effectiveResolution,
            demountTaskId: task.id,
            replacedSimCardId: oldSimId,
            meterId: meter.id,
          } as Prisma.InputJsonValue,
        },
      });
    } else {
      if (!effectiveMeterDemountCategory) {
        throw new BadRequestException(
          'Za ovu rezoluciju navedite kategoriju demontaže brojila (bez SIM-a).',
        );
      }
      const demountedFromLocation =
        effectiveResolution === DemountCompletionResolution.FULL_DEMOUNT ||
        (effectiveResolution === DemountCompletionResolution.REMOVE_SIM_ONLY &&
          effectiveMeterDemountCategory !== MeterDemountCategory.TEMPORARY_REMOVAL);
      await this.prisma.$transaction(async (tx) => {
        await tx.meter.update({
          where: { id: meter.id },
          data: {
            simCardId: null,
            simCardState: MeterSimCardState.NO_SIM,
            noSimReason: effectiveReason,
            lastSimDemountCategory: effectiveMeterDemountCategory,
            isDemountedFromLocation: demountedFromLocation,
            hasOpenDemountTask: false,
            status:
              effectiveMeterDemountCategory === MeterDemountCategory.METER_FAULTY
                ? MeterStatus.DEFECTIVE
                : effectiveMeterDemountCategory === MeterDemountCategory.MAINTENANCE
                  ? MeterStatus.IN_CALIBRATION
                  : MeterStatus.ACTIVE,
          },
        });
        await tx.simCard.update({
          where: { id: oldSimId },
          data: oldSimRemoval,
        });
        await tx.demountTask.update({
          where: { id: task.id },
          data: {
            status: DemountTaskStatus.COMPLETED,
            completedAt: new Date(),
            completionResolution: effectiveResolution,
            completionReason: effectiveReason,
            removedSimDisposition: effectiveRemovedSimDisposition,
            meterDemountCategory: effectiveMeterDemountCategory,
          },
        });
      });
      const branchId = meter.branchId ?? undefined;
      await this.prisma.simEvent.create({
        data: {
          simCardId: oldSimId,
          type: 'DEMOUNTED',
          userId,
          branchId: branchId ?? null,
          metadata: {
            resolution: effectiveResolution,
            demountTaskId: task.id,
            meterId: meter.id,
            removedSimDisposition: effectiveRemovedSimDisposition,
            meterDemountCategory: effectiveMeterDemountCategory,
            demountedFromLocation,
          } as Prisma.InputJsonValue,
        },
      });
    }

    await this.activityLogService.log({
      userId,
      action: 'UPDATE',
      entity: 'demount_task',
      entityId: id,
      details: {
        status: DemountTaskStatus.COMPLETED,
        completionResolution: effectiveResolution,
      },
      ipAddress,
    });

    const out = await this.prisma.demountTask.findUniqueOrThrow({
      where: { id },
      include: {
        meter: { include: { simCard: true, meterTypeDefinition: true } },
        assignedTo: true,
        createdBy: true,
      },
    });

    await this.notificationsService.create({
      userId: out.createdById,
      title: 'Završen zadatak demontaže',
      message: `Zadatak demontaže za brojilo ${out.meter?.serialNumber ?? out.meterId} je završen.`,
      type: 'DEMOUNT_TASK_COMPLETED',
      link: `/meters/${out.meterId}`,
    });

    return out;
  }

  private buildOldSimRemovalUpdate(
    disposition: RemovedSimDisposition,
  ): { status: SimCardStatus; assignedToId: null; assignedAt: null } {
    if (disposition === RemovedSimDisposition.MARK_DEFECTIVE) {
      return {
        status: SimCardStatus.DEFECTIVE,
        assignedToId: null,
        assignedAt: null,
      };
    }
    return {
      status: SimCardStatus.AVAILABLE,
      assignedToId: null,
      assignedAt: null,
    };
  }

  private async assertSimUsableForReplace(
    simId: string,
    operatorId: string,
    meterDistributionId: string | null,
    scope?: ScopeContext | null,
  ): Promise<void> {
    const scopeClause = scopeWhere(scope, { viaShipment: true });
    const sim = await this.prisma.simCard.findFirst({
      where: {
        id: simId,
        ...(scopeClause ? { AND: [scopeClause] } : {}),
      },
      include: {
        shipment: { select: { distributionId: true } },
        meter: { select: { id: true } },
      },
    });
    if (!sim) {
      throw new BadRequestException('Nova SIM kartica nije pronađena ili nije u vašem djelokrugu.');
    }
    if (sim.meter) {
      throw new BadRequestException('Nova SIM je već vezana za brojilo.');
    }
    const okForOperator =
      sim.status === SimCardStatus.AVAILABLE ||
      (sim.status === SimCardStatus.ASSIGNED && sim.assignedToId === operatorId);
    if (!okForOperator) {
      throw new BadRequestException(
        'Nova SIM mora biti dostupna ili zadužena od strane vas kao operatera.',
      );
    }
    if (
      meterDistributionId &&
      sim.shipment.distributionId &&
      sim.shipment.distributionId !== meterDistributionId
    ) {
      throw new BadRequestException('Nova SIM mora biti iz iste distribucije kao podružnica brojila.');
    }
  }
}
