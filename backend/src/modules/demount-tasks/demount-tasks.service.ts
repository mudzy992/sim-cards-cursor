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
  MeterSimCardState,
  SimCardStatus,
  Prisma,
} from '@prisma/client';
import { ActivityLogService } from '../activity-log/activity-log.service';

@Injectable()
export class DemountTasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogService: ActivityLogService,
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
      include: { simCard: true },
    });
    if (!meter) {
      throw new BadRequestException('Brojilo nije pronađeno.');
    }
    if (!meter.simCardId) {
      throw new BadRequestException('Brojilo nema ugradjenu SIM karticu.');
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

    const task = await this.prisma.demountTask.create({
      data: {
        meterId: dto.meterId,
        assignedToId: dto.assignedToId,
        createdById,
        notes: dto.notes,
        taskType: dto.taskType ?? undefined,
      },
      include: {
        meter: { include: { simCard: true, meterTypeDefinition: true } },
        assignedTo: true,
        createdBy: true,
      },
    });

    await this.activityLogService.log({
      userId: createdById,
      action: 'CREATE',
      entity: 'demount_task',
      entityId: task.id,
      details: { meterId: dto.meterId, assignedToId: dto.assignedToId, taskType: task.taskType },
      ipAddress,
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
    const task = await this.prisma.demountTask.findUnique({
      where: { id },
    });
    if (!task) {
      throw new NotFoundException('Zadatak demontaže nije pronađen.');
    }
    if (task.assignedToId !== userId) {
      throw new BadRequestException('Samo operator kojem je zadatak dodijeljen može ažurirati status.');
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
    const meterDistributionId = meter.branch?.distributionId ?? null;
    if (dto.resolution === DemountCompletionResolution.REPLACE_SIM) {
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
          },
        });
        await tx.simCard.update({
          where: { id: oldSimId },
          data: {
            status: SimCardStatus.DEMOUNTED,
            assignedToId: null,
            assignedAt: null,
          },
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
            completionResolution: dto.resolution,
            completionReason: dto.reason,
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
            resolution: dto.resolution,
            demountTaskId: task.id,
            replacedBySimCardId: dto.newSimCardId,
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
            resolution: dto.resolution,
            demountTaskId: task.id,
            replacedSimCardId: oldSimId,
            meterId: meter.id,
          } as Prisma.InputJsonValue,
        },
      });
    } else {
      await this.prisma.$transaction(async (tx) => {
        await tx.meter.update({
          where: { id: meter.id },
          data: {
            simCardId: null,
            simCardState: MeterSimCardState.NO_SIM,
            noSimReason: dto.reason,
          },
        });
        await tx.simCard.update({
          where: { id: oldSimId },
          data: {
            status: SimCardStatus.DEMOUNTED,
            assignedToId: null,
            assignedAt: null,
          },
        });
        await tx.demountTask.update({
          where: { id: task.id },
          data: {
            status: DemountTaskStatus.COMPLETED,
            completedAt: new Date(),
            completionResolution: dto.resolution,
            completionReason: dto.reason,
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
            resolution: dto.resolution,
            demountTaskId: task.id,
            meterId: meter.id,
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
        completionResolution: dto.resolution,
      },
      ipAddress,
    });

    return this.prisma.demountTask.findUniqueOrThrow({
      where: { id },
      include: {
        meter: { include: { simCard: true, meterTypeDefinition: true } },
        assignedTo: true,
        createdBy: true,
      },
    });
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
