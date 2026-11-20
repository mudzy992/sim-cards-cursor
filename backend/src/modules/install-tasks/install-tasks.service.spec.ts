import { BadRequestException } from '@nestjs/common';
import {
  InstallTaskStatus,
  MeterSimCardState,
  MeterStatus,
  UserRole,
  type User,
} from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { InstallationRecordsService } from '../installation-records/installation-records.service';
import { MeterTypeFieldsService } from '../meter-type-definitions/meter-type-fields.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SimCardsService } from '../sim-cards/sim-cards.service';
import { InstallTasksService } from './install-tasks.service';

describe('InstallTasksService — lifecycle & atomic locks', () => {
  function createMocks() {
    const tx = {
      meter: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({ id: 'meter-1' }),
      },
      installTask: {
        create: jest.fn().mockResolvedValue({
          id: 'task-1',
          meterId: 'meter-1',
          assignedToId: 'op-1',
          createdById: 'admin-1',
          status: InstallTaskStatus.PENDING,
          meter: { serialNumber: 'SN-100' },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'task-1',
          meterId: 'meter-1',
          createdById: 'admin-1',
          status: InstallTaskStatus.COMPLETED,
          meter: { serialNumber: 'SN-100' },
        }),
      },
    };

    const prisma = {
      meter: {
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'meter-1' }),
      },
      user: {
        findUnique: jest.fn(),
      },
      branchModerator: {
        findUnique: jest.fn(),
      },
      installTask: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(async (cb: (client: typeof tx) => Promise<unknown>) => cb(tx)),
    };

    const activityLogService = { log: jest.fn().mockResolvedValue(undefined) };
    const installationRecordsService = {
      create: jest.fn().mockResolvedValue({ id: 'rec-1' }),
    };
    const meterTypeFieldsService = {
      validateDynamicValues: jest.fn().mockResolvedValue({}),
    };
    const notificationsService = { create: jest.fn().mockResolvedValue(undefined) };
    const simCardsService = { claim: jest.fn().mockResolvedValue({ id: 'sim-1' }) };

    const service = new InstallTasksService(
      prisma as unknown as PrismaService,
      activityLogService as unknown as ActivityLogService,
      installationRecordsService as unknown as InstallationRecordsService,
      meterTypeFieldsService as unknown as MeterTypeFieldsService,
      notificationsService as unknown as NotificationsService,
      simCardsService as unknown as SimCardsService,
    );

    return {
      service,
      prisma,
      tx,
      activityLogService,
      installationRecordsService,
      notificationsService,
      simCardsService,
    };
  }

  const adminScope = { role: UserRole.SYSTEM_ADMIN, distributionId: null, branchId: null };

  it('rejects create when meter already has an open install task', async () => {
    const { service, prisma } = createMocks();
    prisma.meter.findFirst.mockResolvedValueOnce({
      id: 'meter-1',
      branchId: 'branch-1',
      simCardId: null,
      simCardState: MeterSimCardState.NO_SIM,
      status: MeterStatus.ACTIVE,
      hasOpenInstallTask: true,
    });

    await expect(
      service.create({ meterId: 'meter-1', assignedToId: 'op-1' }, 'admin-1', adminScope),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects create when concurrent lock on meter updateMany returns 0 rows', async () => {
    const { service, prisma, tx } = createMocks();
    prisma.meter.findFirst.mockResolvedValueOnce({
      id: 'meter-1',
      branchId: 'branch-1',
      simCardId: null,
      simCardState: MeterSimCardState.NO_SIM,
      status: MeterStatus.ACTIVE,
      hasOpenInstallTask: false,
    });
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'op-1',
      role: UserRole.USER,
      branchId: 'branch-1',
      distributionId: 'dist-1',
      branch: { distributionId: 'dist-1' },
    });
    tx.meter.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.create({ meterId: 'meter-1', assignedToId: 'op-1' }, 'admin-1', adminScope),
    ).rejects.toThrow(BadRequestException);

    expect(tx.installTask.create).not.toHaveBeenCalled();
  });

  it('creates install task atomically, sets hasOpenInstallTask, logs and notifies assignee', async () => {
    const { service, prisma, tx, activityLogService, notificationsService } = createMocks();
    prisma.meter.findFirst.mockResolvedValueOnce({
      id: 'meter-1',
      branchId: 'branch-1',
      simCardId: null,
      simCardState: MeterSimCardState.NO_SIM,
      status: MeterStatus.ACTIVE,
      hasOpenInstallTask: false,
    });
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'op-1',
      role: UserRole.USER,
      branchId: 'branch-1',
      distributionId: 'dist-1',
      branch: { distributionId: 'dist-1' },
    });

    const created = await service.create(
      { meterId: 'meter-1', assignedToId: 'op-1', notes: 'Install ASAP' },
      'admin-1',
      adminScope,
      '127.0.0.1',
    );

    expect(created.id).toBe('task-1');
    expect(tx.meter.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'meter-1', hasOpenInstallTask: false }),
        data: { hasOpenInstallTask: true },
      }),
    );
    expect(activityLogService.log).toHaveBeenCalled();
    expect(notificationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'op-1', type: 'INSTALL_TASK_ASSIGNED' }),
    );
  });

  it('clears assignedToId when operator returns IN_PROGRESS task to PENDING', async () => {
    const { service, prisma } = createMocks();
    prisma.installTask.findUnique.mockResolvedValueOnce({
      id: 'task-1',
      meterId: 'meter-1',
      assignedToId: 'op-1',
      createdById: 'admin-1',
      status: InstallTaskStatus.IN_PROGRESS,
      meter: { id: 'meter-1', serialNumber: 'SN-100' },
    });
    prisma.installTask.update.mockResolvedValueOnce({
      id: 'task-1',
      status: InstallTaskStatus.PENDING,
      assignedToId: null,
      meter: { serialNumber: 'SN-100' },
    });
    prisma.installTask.findFirst.mockResolvedValueOnce(null);

    await service.updateStatus('task-1', InstallTaskStatus.PENDING, 'op-1');

    expect(prisma.installTask.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'task-1' },
        data: { status: InstallTaskStatus.PENDING, assignedToId: null },
      }),
    );
  });

  it('releases meter.hasOpenInstallTask when cancelled by initiator/admin', async () => {
    const { service, prisma } = createMocks();
    prisma.installTask.findUnique.mockResolvedValueOnce({
      id: 'task-1',
      meterId: 'meter-1',
      assignedToId: 'op-1',
      createdById: 'admin-1',
      status: InstallTaskStatus.PENDING,
      meter: { id: 'meter-1', serialNumber: 'SN-100' },
    });
    prisma.installTask.update.mockResolvedValueOnce({
      id: 'task-1',
      meterId: 'meter-1',
      assignedToId: 'op-1',
      status: InstallTaskStatus.CANCELLED,
      meter: { id: 'meter-1', serialNumber: 'SN-100' },
    });

    await service.cancel('task-1', { id: 'admin-1', role: UserRole.SYSTEM_ADMIN } as User);

    expect(prisma.meter.update).toHaveBeenCalledWith({
      where: { id: 'meter-1' },
      data: { hasOpenInstallTask: false },
    });
  });

  it('completes IN_PROGRESS install task, validates demounted location, claims SIM and clears flag', async () => {
    const { service, prisma, tx, simCardsService, installationRecordsService } = createMocks();
    prisma.installTask.findFirst.mockResolvedValueOnce({
      id: 'task-1',
      assignedToId: 'op-1',
      createdById: 'admin-1',
      status: InstallTaskStatus.IN_PROGRESS,
      meter: {
        id: 'meter-1',
        status: MeterStatus.ACTIVE,
        simCardId: null,
        simCardState: MeterSimCardState.NO_SIM,
        meterTypeDefinitionId: 'mtd-1',
        year: 2024,
        calibrationYear: 2025,
        isDemountedFromLocation: true,
      },
    });

    // Missing location fields must be rejected for demounted meters.
    await expect(
      service.complete('task-1', { simCardId: 'sim-1' }, 'op-1', adminScope),
    ).rejects.toThrow(BadRequestException);

    // Now supply complete location fields.
    prisma.installTask.findFirst.mockResolvedValueOnce({
      id: 'task-1',
      assignedToId: 'op-1',
      createdById: 'admin-1',
      status: InstallTaskStatus.IN_PROGRESS,
      meter: {
        id: 'meter-1',
        status: MeterStatus.ACTIVE,
        simCardId: null,
        simCardState: MeterSimCardState.NO_SIM,
        meterTypeDefinitionId: 'mtd-1',
        year: 2024,
        calibrationYear: 2025,
        isDemountedFromLocation: true,
      },
    });

    const completed = await service.complete(
      'task-1',
      {
        simCardId: 'sim-1',
        installationAddress: 'Zmaja od Bosne 1',
        city: 'Sarajevo',
        municipality: 'Centar',
        measuringPoint: 'MP-10',
      },
      'op-1',
      adminScope,
      '127.0.0.1',
    );

    expect(completed.status).toBe(InstallTaskStatus.COMPLETED);
    expect(simCardsService.claim).toHaveBeenCalledWith('sim-1', 'op-1', '127.0.0.1', adminScope);
    expect(installationRecordsService.create).toHaveBeenCalled();
    expect(tx.installTask.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'task-1', status: InstallTaskStatus.IN_PROGRESS },
        data: expect.objectContaining({
          status: InstallTaskStatus.COMPLETED,
          installationRecordId: 'rec-1',
        }),
      }),
    );
    expect(tx.meter.update).toHaveBeenCalledWith({
      where: { id: 'meter-1' },
      data: { hasOpenInstallTask: false },
    });
  });
});
