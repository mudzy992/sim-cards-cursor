import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { scopeWhere, ScopeContext } from 'src/common/utils/scope-filter.util';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateDemountTaskDto } from './dto/create-demount-task.dto';
import { DemountTaskStatus } from '@prisma/client';
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
      details: { meterId: dto.meterId, assignedToId: dto.assignedToId },
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
        ...(status === DemountTaskStatus.COMPLETED
          ? { completedAt: new Date() }
          : {}),
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
}
