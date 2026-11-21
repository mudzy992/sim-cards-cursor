import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  DemountCompletionResolution,
  DemountTaskStatus,
  MeterDemountCategory,
  MeterSimCardState,
  MeterStatus,
  RemovedSimDisposition,
  SimCardStatus,
  UserRole,
  UserStatus,
  type User,
} from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DemountTasksService } from './demount-tasks.service';

describe('DemountTasksService — lifecycle & completion resolutions', () => {
  function createMocks() {
    const tx = {
      meter: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({ id: 'meter-1' }),
      },
      simCard: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({ id: 'sim-old' }),
      },
      simEvent: {
        create: jest.fn().mockResolvedValue({ id: 'evt-1' }),
      },
      demountTask: {
        create: jest.fn().mockResolvedValue({
          id: 'dtask-1',
          meterId: 'meter-1',
          assignedToId: 'op-1',
          createdById: 'admin-1',
          taskType: 'DEMOUNT_SIM',
          meter: { serialNumber: 'SN-200' },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({
          id: 'dtask-1',
          meterId: 'meter-1',
          assignedToId: 'op-1',
          status: DemountTaskStatus.CANCELLED,
          meter: { serialNumber: 'SN-200' },
        }),
      },
    };

    const prisma = {
      meter: {
        findFirst: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      branchModerator: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      simCard: {
        findFirst: jest.fn(),
      },
      demountTask: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'dtask-1',
          meterId: 'meter-1',
          createdById: 'admin-1',
          status: DemountTaskStatus.COMPLETED,
          meter: { serialNumber: 'SN-200' },
        }),
      },
      $transaction: jest.fn(async (cb: (client: typeof tx) => Promise<unknown>) => cb(tx)),
    };

    const activityLogService = { log: jest.fn().mockResolvedValue(undefined) };
    const notificationsService = { create: jest.fn().mockResolvedValue(undefined) };

    const service = new DemountTasksService(
      prisma as unknown as PrismaService,
      activityLogService as unknown as ActivityLogService,
      notificationsService as unknown as NotificationsService,
    );

    return { service, prisma, tx, activityLogService, notificationsService };
  }

  const adminScope = { role: UserRole.SYSTEM_ADMIN, distributionId: null, branchId: null };

  it('rejects create when meter has no installed SIM', async () => {
    const { service, prisma } = createMocks();
    prisma.meter.findFirst.mockResolvedValueOnce({
      id: 'meter-1',
      branchId: 'branch-1',
      simCardId: null,
      simCardState: MeterSimCardState.NO_SIM,
      status: MeterStatus.ACTIVE,
      hasOpenDemountTask: false,
    });

    await expect(
      service.create(
        {
          meterId: 'meter-1',
          assignedToId: 'op-1',
          requestedResolution: DemountCompletionResolution.REMOVE_SIM_ONLY,
          requestedReason: 'Privremeno uklanjanje radi servisa',
          requestedRemovedSimDisposition: 'RETURN_TO_STOCK',
          requestedMeterDemountCategory: 'TEMPORARY_REMOVAL',
        },
        'admin-1',
        '127.0.0.1',
        adminScope,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('creates demount task atomically and notifies assignee', async () => {
    const { service, prisma, tx, notificationsService } = createMocks();
    prisma.meter.findFirst.mockResolvedValueOnce({
      id: 'meter-1',
      branchId: 'branch-1',
      simCardId: 'sim-old',
      simCardState: MeterSimCardState.INSTALLED,
      status: MeterStatus.ACTIVE,
      hasOpenDemountTask: false,
    });
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'op-1',
      role: UserRole.USER,
      branchId: 'branch-1',
      distributionId: 'dist-1',
      branch: { distributionId: 'dist-1' },
    });

    const created = await service.create(
      {
        meterId: 'meter-1',
        assignedToId: 'op-1',
        requestedResolution: DemountCompletionResolution.REMOVE_SIM_ONLY,
        requestedReason: 'Privremeno uklanjanje radi servisa',
        requestedRemovedSimDisposition: 'RETURN_TO_STOCK',
        requestedMeterDemountCategory: 'TEMPORARY_REMOVAL',
      },
      'admin-1',
      '127.0.0.1',
      adminScope,
    );

    expect(created.id).toBe('dtask-1');
    expect(tx.meter.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'meter-1', hasOpenDemountTask: false }),
        data: { hasOpenDemountTask: true },
      }),
    );
    expect(notificationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'op-1', type: 'DEMOUNT_TASK_ASSIGNED' }),
    );
  });

  it('rejects overriding locked requestedResolution from task creator', async () => {
    const { service, prisma } = createMocks();
    prisma.demountTask.findFirst.mockResolvedValueOnce({
      id: 'dtask-1',
      assignedToId: 'op-1',
      createdById: 'admin-1',
      status: DemountTaskStatus.IN_PROGRESS,
      requestedResolution: DemountCompletionResolution.FULL_DEMOUNT,
      requestedReason: null,
      requestedRemovedSimDisposition: null,
      requestedMeterDemountCategory: null,
      meter: {
        id: 'meter-1',
        simCardId: 'sim-old',
        branchId: 'branch-1',
        branch: { id: 'branch-1', distributionId: 'dist-1' },
      },
    });

    await expect(
      service.complete(
        'dtask-1',
        {
          resolution: DemountCompletionResolution.REMOVE_SIM_ONLY,
          reason: 'Pokusaj izmjene',
          removedSimDisposition: RemovedSimDisposition.RETURN_TO_STOCK,
          meterDemountCategory: MeterDemountCategory.TEMPORARY_REMOVAL,
        },
        'op-1',
        '127.0.0.1',
        adminScope,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('completes REPLACE_SIM atomically: claims new SIM, marks old SIM defective, logs both SimEvents', async () => {
    const { service, prisma, tx } = createMocks();
    prisma.demountTask.findFirst.mockResolvedValueOnce({
      id: 'dtask-1',
      assignedToId: 'op-1',
      createdById: 'admin-1',
      status: DemountTaskStatus.IN_PROGRESS,
      requestedResolution: null,
      requestedReason: null,
      requestedRemovedSimDisposition: null,
      requestedMeterDemountCategory: null,
      meter: {
        id: 'meter-1',
        simCardId: 'sim-old',
        branchId: 'branch-1',
        branch: { id: 'branch-1', distributionId: 'dist-1' },
      },
    });
    prisma.simCard.findFirst.mockResolvedValueOnce({
      id: 'sim-new',
      status: SimCardStatus.AVAILABLE,
      assignedToId: null,
      shipment: { distributionId: 'dist-1' },
      meter: null,
    });

    await service.complete(
      'dtask-1',
      {
        resolution: DemountCompletionResolution.REPLACE_SIM,
        reason: 'Zamjena neispravne SIM kartice',
        removedSimDisposition: RemovedSimDisposition.MARK_DEFECTIVE,
        newSimCardId: 'sim-new',
      },
      'op-1',
      '127.0.0.1',
      adminScope,
    );

    expect(tx.simCard.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'sim-new' }),
        data: { status: SimCardStatus.INSTALLED, assignedToId: 'op-1' },
      }),
    );
    expect(tx.meter.update).toHaveBeenCalledWith({
      where: { id: 'meter-1' },
      data: {
        simCardId: 'sim-new',
        simCardState: MeterSimCardState.INSTALLED,
        noSimReason: null,
        hasOpenDemountTask: false,
      },
    });
    expect(tx.simCard.update).toHaveBeenCalledWith({
      where: { id: 'sim-old' },
      data: {
        status: SimCardStatus.DEFECTIVE,
        assignedToId: null,
        assignedAt: null,
      },
    });
    expect(tx.simEvent.create).toHaveBeenCalledTimes(2);
  });

  it('completes REMOVE_SIM_ONLY with TEMPORARY_REMOVAL keeping meter ACTIVE and on location', async () => {
    const { service, prisma, tx } = createMocks();
    prisma.demountTask.findFirst.mockResolvedValueOnce({
      id: 'dtask-1',
      assignedToId: 'op-1',
      createdById: 'admin-1',
      status: DemountTaskStatus.IN_PROGRESS,
      requestedResolution: null,
      requestedReason: null,
      requestedRemovedSimDisposition: null,
      requestedMeterDemountCategory: null,
      meter: {
        id: 'meter-1',
        simCardId: 'sim-old',
        branchId: 'branch-1',
        branch: { id: 'branch-1', distributionId: 'dist-1' },
      },
    });

    await service.complete(
      'dtask-1',
      {
        resolution: DemountCompletionResolution.REMOVE_SIM_ONLY,
        reason: 'Privremeno uklanjanje SIM kartice',
        removedSimDisposition: RemovedSimDisposition.RETURN_TO_STOCK,
        meterDemountCategory: MeterDemountCategory.TEMPORARY_REMOVAL,
      },
      'op-1',
      '127.0.0.1',
      adminScope,
    );

    expect(tx.meter.update).toHaveBeenCalledWith({
      where: { id: 'meter-1' },
      data: expect.objectContaining({
        simCardId: null,
        simCardState: MeterSimCardState.NO_SIM,
        isDemountedFromLocation: false,
        hasOpenDemountTask: false,
        status: MeterStatus.ACTIVE,
      }),
    });
    expect(tx.simCard.update).toHaveBeenCalledWith({
      where: { id: 'sim-old' },
      data: {
        status: SimCardStatus.AVAILABLE,
        assignedToId: null,
        assignedAt: null,
      },
    });
  });

  it('completes FULL_DEMOUNT setting meter INACTIVE and isDemountedFromLocation true', async () => {
    const { service, prisma, tx } = createMocks();
    prisma.demountTask.findFirst.mockResolvedValueOnce({
      id: 'dtask-1',
      assignedToId: 'op-1',
      createdById: 'admin-1',
      status: DemountTaskStatus.IN_PROGRESS,
      requestedResolution: null,
      requestedReason: null,
      requestedRemovedSimDisposition: null,
      requestedMeterDemountCategory: null,
      meter: {
        id: 'meter-1',
        simCardId: 'sim-old',
        branchId: 'branch-1',
        branch: { id: 'branch-1', distributionId: 'dist-1' },
      },
    });

    await service.complete(
      'dtask-1',
      {
        resolution: DemountCompletionResolution.FULL_DEMOUNT,
        reason: 'Kompletna demontaža brojila sa terena',
        removedSimDisposition: RemovedSimDisposition.RETURN_TO_STOCK,
        meterDemountCategory: MeterDemountCategory.OTHER,
      },
      'op-1',
      '127.0.0.1',
      adminScope,
    );

    expect(tx.meter.update).toHaveBeenCalledWith({
      where: { id: 'meter-1' },
      data: expect.objectContaining({
        simCardId: null,
        simCardState: MeterSimCardState.NO_SIM,
        isDemountedFromLocation: true,
        hasOpenDemountTask: false,
        status: MeterStatus.INACTIVE,
      }),
    });
  });

  describe('Run 5 hardening', () => {
    it('rejects assigning demount task to INACTIVE operator', async () => {
      const { service, prisma } = createMocks();
      prisma.meter.findFirst.mockResolvedValueOnce({
        id: 'meter-1',
        branchId: 'branch-1',
        simCardId: 'sim-old',
        simCardState: MeterSimCardState.INSTALLED,
        status: MeterStatus.ACTIVE,
        hasOpenDemountTask: false,
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
        service.create(
          {
            meterId: 'meter-1',
            assignedToId: 'op-inactive',
            requestedResolution: DemountCompletionResolution.REMOVE_SIM_ONLY,
            requestedReason: 'Privremeno uklanjanje',
            requestedRemovedSimDisposition: 'RETURN_TO_STOCK',
            requestedMeterDemountCategory: 'TEMPORARY_REMOVAL',
          },
          'admin-1',
          '127.0.0.1',
          adminScope,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('blocks non-moderator USER from findAll and cross-distribution DIST_ADMIN cancel', async () => {
      const { service, prisma } = createMocks();
      await expect(
        service.findAll(
          { page: 1, limit: 20 },
          'user-1',
          { role: UserRole.USER, distributionId: 'dist-1', branchId: 'branch-1', branchModeratorBranchIds: [] },
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);

      prisma.demountTask.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.cancel(
          'dtask-other',
          { id: 'dadmin-1', role: UserRole.DIST_ADMIN } as User,
          '127.0.0.1',
          { role: UserRole.DIST_ADMIN, distributionId: 'dist-1', branchId: null },
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects complete when meter is INACTIVE and accepts trimmed locked requestedReason', async () => {
      const { service, prisma } = createMocks();
      prisma.demountTask.findFirst.mockResolvedValueOnce({
        id: 'dtask-1',
        assignedToId: 'op-1',
        createdById: 'admin-1',
        status: DemountTaskStatus.IN_PROGRESS,
        meter: {
          id: 'meter-1',
          status: MeterStatus.INACTIVE,
          simCardId: 'sim-old',
          branchId: 'branch-1',
          branch: { id: 'branch-1', distributionId: 'dist-1' },
        },
      });

      await expect(
        service.complete(
          'dtask-1',
          {
            resolution: DemountCompletionResolution.REMOVE_SIM_ONLY,
            reason: 'Razlog uklanjanja',
            removedSimDisposition: RemovedSimDisposition.RETURN_TO_STOCK,
            meterDemountCategory: MeterDemountCategory.TEMPORARY_REMOVAL,
          },
          'op-1',
          '127.0.0.1',
          adminScope,
        ),
      ).rejects.toThrow(BadRequestException);

      prisma.demountTask.findFirst.mockResolvedValueOnce({
        id: 'dtask-1',
        assignedToId: 'op-1',
        createdById: 'admin-1',
        status: DemountTaskStatus.IN_PROGRESS,
        requestedResolution: DemountCompletionResolution.REMOVE_SIM_ONLY,
        requestedReason: '  Servisiranje brojila  ',
        requestedRemovedSimDisposition: RemovedSimDisposition.RETURN_TO_STOCK,
        requestedMeterDemountCategory: MeterDemountCategory.TEMPORARY_REMOVAL,
        meter: {
          id: 'meter-1',
          status: MeterStatus.ACTIVE,
          simCardId: 'sim-old',
          branchId: 'branch-1',
          branch: { id: 'branch-1', distributionId: 'dist-1' },
        },
      });

      const completed = await service.complete(
        'dtask-1',
        {
          resolution: DemountCompletionResolution.REMOVE_SIM_ONLY,
          reason: 'Servisiranje brojila',
          removedSimDisposition: RemovedSimDisposition.RETURN_TO_STOCK,
          meterDemountCategory: MeterDemountCategory.TEMPORARY_REMOVAL,
        },
        'op-1',
        '127.0.0.1',
        adminScope,
      );

      expect(completed.status).toBe(DemountTaskStatus.COMPLETED);
    });
  });
});
