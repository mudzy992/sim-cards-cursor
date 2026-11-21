import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { SimCardStatus, UserRole } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { SimCardsService } from './sim-cards.service';

describe('SimCardsService — Run 2 security, integrity & bulk workflows', () => {
  function createMocks() {
    const tx = {
      simCard: {
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
        count: jest.fn().mockResolvedValue(1),
      },
      simEvent: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      shipment: {
        update: jest.fn().mockResolvedValue({ id: 'ship-1' }),
      },
    };

    const prisma = {
      simCard: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
      },
      simEvent: {
        create: jest.fn().mockResolvedValue({ id: 'ev-1' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      shipment: {
        findFirst: jest.fn().mockResolvedValue({ id: 'ship-1' }),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'user-target' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn(async (arg: unknown) => {
        if (typeof arg === 'function') {
          return (arg as (client: typeof tx) => Promise<unknown>)(tx);
        }
        return Promise.all(arg as Promise<unknown>[]);
      }),
    };

    const activityLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const service = new SimCardsService(
      prisma as unknown as PrismaService,
      activityLogService as unknown as ActivityLogService,
    );

    return { service, prisma, tx, activityLogService };
  }

  const sysAdmin = {
    role: UserRole.SYSTEM_ADMIN,
    distributionId: null,
    branchId: null,
  };

  const moderator = {
    role: UserRole.USER,
    distributionId: 'dist-1',
    branchId: 'branch-1',
    branchModeratorBranchIds: ['branch-2'],
  };

  it('restricts BranchModerator findOne/listEvents to moderated branches instead of whole distribution', async () => {
    const { service, prisma } = createMocks();
    prisma.simCard.findFirst.mockResolvedValueOnce(null);

    await expect(service.findOne('sim-other-branch', moderator, 'mod-user-1')).rejects.toThrow(
      NotFoundException,
    );

    expect(prisma.simCard.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'sim-other-branch',
          OR: [
            { meter: { is: { branchId: { in: ['branch-1', 'branch-2'] } } } },
            { assignedToId: 'mod-user-1' },
          ],
        },
      }),
    );
  });

  it('rejects duplicate publicIpAddress or phoneNumber when updating a SIM card', async () => {
    const { service, prisma } = createMocks();
    prisma.simCard.findFirst
      .mockResolvedValueOnce({
        id: 'sim-1',
        shipmentId: 'ship-1',
        status: SimCardStatus.AVAILABLE,
        meter: null,
      })
      .mockResolvedValueOnce({
        iccid: '89387000000000000099',
        ipAddress: '10.10.0.99',
        publicIpAddress: '31.47.0.5',
        phoneNumber: null,
      });

    await expect(
      service.update(
        'sim-1',
        { publicIpAddress: ' 31.47.0.5 ' },
        'admin-1',
        '127.0.0.1',
        sysAdmin,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('blocks status changes on INSTALLED SIM cards that are attached to a meter', async () => {
    const { service, prisma } = createMocks();
    prisma.simCard.findFirst.mockResolvedValueOnce({
      id: 'sim-1',
      shipmentId: 'ship-1',
      status: SimCardStatus.INSTALLED,
      meter: { id: 'meter-1' },
    });

    await expect(
      service.update(
        'sim-1',
        { status: SimCardStatus.AVAILABLE },
        'admin-1',
        '127.0.0.1',
        sysAdmin,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('updates totalCards on both old and new shipments when update moves a SIM card', async () => {
    const { service, prisma, tx } = createMocks();
    prisma.simCard.findFirst
      .mockResolvedValueOnce({
        id: 'sim-1',
        shipmentId: 'ship-1',
        status: SimCardStatus.AVAILABLE,
        meter: null,
      })
      .mockResolvedValueOnce(null);
    tx.simCard.update.mockResolvedValueOnce({ id: 'sim-1', shipmentId: 'ship-2' });
    tx.simCard.count.mockResolvedValueOnce(9).mockResolvedValueOnce(4);

    await service.update('sim-1', { shipmentId: 'ship-2' }, 'admin-1', '127.0.0.1', sysAdmin);

    expect(tx.shipment.update).toHaveBeenCalledWith({
      where: { id: 'ship-1' },
      data: { totalCards: 9 },
    });
    expect(tx.shipment.update).toHaveBeenCalledWith({
      where: { id: 'ship-2' },
      data: { totalCards: 4 },
    });
  });

  it('normalizes ICCID in scanByIccid and batches offline sync via scanBatch', async () => {
    const { service, prisma } = createMocks();
    prisma.simCard.findUnique.mockResolvedValueOnce({
      id: 'sim-1',
      iccid: '89387000000000000001',
    });

    const scanned = await service.scanByIccid(' 8938 7000 0000 0000 0001 ', sysAdmin);
    expect(prisma.simCard.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { iccid: '89387000000000000001' },
      }),
    );
    expect(scanned.id).toBe('sim-1');

    prisma.simCard.findMany.mockResolvedValueOnce([
      { id: 'sim-1', iccid: '89387000000000000001', status: SimCardStatus.AVAILABLE },
    ]);
    const batch = await service.scanBatch(
      ['8938 7000 0000 0000 0001', '89387000000000000002'],
      sysAdmin,
    );
    expect(batch.items).toHaveLength(1);
    expect(batch.notFoundIccids).toEqual(['89387000000000000002']);
  });

  it('bulkAssign updates only AVAILABLE cards in one transaction and records ASSIGNED events', async () => {
    const { service, prisma, tx } = createMocks();
    prisma.simCard.findMany.mockResolvedValueOnce([
      { id: 'sim-1', status: SimCardStatus.AVAILABLE },
      { id: 'sim-2', status: SimCardStatus.INSTALLED },
      { id: 'sim-3', status: SimCardStatus.AVAILABLE },
    ]);
    tx.simCard.updateMany.mockResolvedValueOnce({ count: 2 });

    const res = await service.bulkAssign(
      ['sim-1', 'sim-2', 'sim-3'],
      'user-target',
      'admin-1',
      '127.0.0.1',
      sysAdmin,
    );

    expect(res).toEqual({
      assignedCount: 2,
      requestedCount: 3,
      skippedCount: 1,
    });
    expect(tx.simCard.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { in: ['sim-1', 'sim-3'] },
          status: SimCardStatus.AVAILABLE,
        },
        data: expect.objectContaining({
          assignedToId: 'user-target',
          status: SimCardStatus.ASSIGNED,
        }),
      }),
    );
    expect(tx.simEvent.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ simCardId: 'sim-1', type: 'ASSIGNED' }),
        expect.objectContaining({ simCardId: 'sim-3', type: 'ASSIGNED' }),
      ],
    });
  });

  it('returnToStock returns DEMOUNTED/RETURNED SIM cards to AVAILABLE and rejects INSTALLED ones', async () => {
    const { service, prisma } = createMocks();
    prisma.simCard.findFirst.mockResolvedValueOnce({
      id: 'sim-1',
      status: SimCardStatus.DEMOUNTED,
      meter: null,
    });
    prisma.simCard.update.mockResolvedValueOnce({
      id: 'sim-1',
      status: SimCardStatus.AVAILABLE,
      assignedToId: null,
    });

    const updated = await service.returnToStock('sim-1', 'admin-1', '127.0.0.1', sysAdmin);
    expect(updated.status).toBe(SimCardStatus.AVAILABLE);
    expect(prisma.simEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        simCardId: 'sim-1',
        type: 'RETURNED_TO_STOCK',
      }),
    });

    prisma.simCard.findFirst.mockResolvedValueOnce({
      id: 'sim-2',
      status: SimCardStatus.INSTALLED,
      meter: { id: 'meter-1' },
    });
    await expect(
      service.returnToStock('sim-2', 'admin-1', '127.0.0.1', sysAdmin),
    ).rejects.toThrow(BadRequestException);
  });
});
