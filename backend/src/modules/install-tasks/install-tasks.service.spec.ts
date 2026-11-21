import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  InstallTaskStatus,
  MeterSimCardState,
  MeterStatus,
  UserRole,
  UserStatus,
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
        findMany: jest.fn().mockResolvedValue([]),
      },
      installTask: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
      installationRecord: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      simCard: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'sim-1',
          status: 'AVAILABLE',
          assignedToId: null,
          shipment: { distributionId: 'dist-1' },
          meter: null,
        }),
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
    expect(installationRecordsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        clientRequestId: 'install-task:task-1',
      }),
      expect.any(Object),
    );
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

  describe('Run 5 hardening', () => {
    it('rejects assigning install task to INACTIVE operator on create and reassign', async () => {
      const { service, prisma } = createMocks();
      prisma.meter.findFirst.mockResolvedValueOnce({
        id: 'meter-1',
        branchId: 'branch-1',
        simCardId: null,
        simCardState: MeterSimCardState.NO_SIM,
        status: MeterStatus.ACTIVE,
        hasOpenInstallTask: false,
      });
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'op-inactive',
        role: UserRole.USER,
        status: UserStatus.INACTIVE,
        branchId: 'branch-1',
        distributionId: 'dist-1',
        branch: { distributionId: 'dist-1' },
      });

      await expect(
        service.create({ meterId: 'meter-1', assignedToId: 'op-inactive' }, 'admin-1', adminScope),
      ).rejects.toThrow(BadRequestException);

      prisma.installTask.findUnique.mockResolvedValueOnce({
        id: 'task-1',
        meterId: 'meter-1',
        createdById: 'admin-1',
        status: InstallTaskStatus.PENDING,
        meter: { id: 'meter-1', serialNumber: 'SN-100', branchId: 'branch-1' },
      });
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'op-inactive',
        role: UserRole.USER,
        status: UserStatus.INACTIVE,
        branchId: 'branch-1',
        distributionId: 'dist-1',
        branch: { distributionId: 'dist-1' },
      });

      await expect(
        service.reassign(
          'task-1',
          'op-inactive',
          { id: 'admin-1', role: UserRole.SYSTEM_ADMIN } as User,
          adminScope,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('blocks non-moderator USER from findAll and blocks moderator reassign to other branch', async () => {
      const { service, prisma } = createMocks();
      await expect(
        service.findAll(
          { page: 1, limit: 20 },
          'user-1',
          { role: UserRole.USER, distributionId: 'dist-1', branchId: 'branch-1', branchModeratorBranchIds: [] },
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);

      prisma.installTask.findFirst.mockResolvedValueOnce({
        id: 'task-1',
        meterId: 'meter-1',
        createdById: 'mod-1',
        status: InstallTaskStatus.PENDING,
        meter: { id: 'meter-1', serialNumber: 'SN-100', branchId: 'branch-1' },
      });
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'op-other-branch',
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        branchId: 'branch-2',
        distributionId: 'dist-1',
        branch: { distributionId: 'dist-1' },
      });

      await expect(
        service.reassign(
          'task-1',
          'op-other-branch',
          { id: 'mod-1', role: UserRole.USER } as User,
          { role: UserRole.USER, distributionId: 'dist-1', branchId: 'branch-1', branchModeratorBranchIds: ['branch-1'] },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('blocks DIST_ADMIN cancel when task is outside distribution scope', async () => {
      const { service, prisma } = createMocks();
      prisma.installTask.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.cancel(
          'task-other-dist',
          { id: 'dadmin-1', role: UserRole.DIST_ADMIN } as User,
          '127.0.0.1',
          { role: UserRole.DIST_ADMIN, distributionId: 'dist-1', branchId: null },
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('checks otherOpen before mutating task in updateStatus', async () => {
      const { service, prisma } = createMocks();
      prisma.installTask.findUnique.mockResolvedValueOnce({
        id: 'task-1',
        meterId: 'meter-1',
        assignedToId: 'op-1',
        createdById: 'admin-1',
        status: InstallTaskStatus.PENDING,
        meter: { id: 'meter-1', serialNumber: 'SN-100' },
      });
      prisma.installTask.findFirst.mockResolvedValueOnce({ id: 'task-other' });

      await expect(
        service.updateStatus('task-1', InstallTaskStatus.IN_PROGRESS, 'op-1'),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.installTask.update).not.toHaveBeenCalled();
    });

    it('recovers idempotently when installation record was already created for this installTask', async () => {
      const { service, prisma, tx, simCardsService, installationRecordsService } = createMocks();
      prisma.installTask.findFirst.mockResolvedValueOnce({
        id: 'task-1',
        assignedToId: 'op-1',
        createdById: 'admin-1',
        status: InstallTaskStatus.IN_PROGRESS,
        meter: {
          id: 'meter-1',
          status: MeterStatus.ACTIVE,
          simCardId: 'sim-1',
          simCardState: MeterSimCardState.INSTALLED,
          meterTypeDefinitionId: 'mtd-1',
          year: 2024,
          calibrationYear: 2025,
          isDemountedFromLocation: false,
          branch: { distributionId: 'dist-1' },
        },
      });
      prisma.installationRecord.findUnique.mockResolvedValueOnce({ id: 'rec-existing' });

      const result = await service.complete('task-1', { simCardId: 'sim-1' }, 'op-1', adminScope);

      expect(result.status).toBe(InstallTaskStatus.COMPLETED);
      expect(simCardsService.claim).not.toHaveBeenCalled();
      expect(installationRecordsService.create).not.toHaveBeenCalled();
      expect(tx.installTask.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ installationRecordId: 'rec-existing' }),
        }),
      );
    });
  });
});
