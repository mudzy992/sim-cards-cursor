import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: {
    installationRecord: {
      groupBy: jest.Mock;
      count: jest.Mock;
      findMany: jest.Mock;
    };
    simCard: {
      groupBy: jest.Mock;
    };
    meter: {
      count: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      installationRecord: {
        groupBy: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      simCard: {
        groupBy: jest.fn().mockResolvedValue([]),
      },
      meter: {
        count: jest.fn().mockResolvedValue(0),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  it('scopes regular USER simCard stats to assignedToId instead of entire distribution', async () => {
    prisma.simCard.groupBy.mockResolvedValue([
      { status: 'ASSIGNED', _count: { id: 3 } },
      { status: 'INSTALLED', _count: { id: 2 } },
    ]);

    const res = await service.getStats({
      userId: 'user-1',
      role: UserRole.USER,
      distributionId: 'dist-1',
      branchId: 'branch-1',
      branchModeratorBranchIds: [],
    });

    expect(res.simCards.total).toBe(5);
    expect(res.simCards.assigned).toBe(3);
    expect(res.simCards.installed).toBe(2);
    expect(prisma.simCard.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: [{ assignedToId: 'user-1' }] },
      }),
    );
  });

  it('scopes BRANCH_MODERATOR simCard stats to moderated branches', async () => {
    await service.getStats({
      userId: 'mod-1',
      role: UserRole.USER,
      distributionId: 'dist-1',
      branchId: 'branch-1',
      branchModeratorBranchIds: ['branch-1', 'branch-2'],
    });

    expect(prisma.simCard.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            {
              OR: [
                { meter: { branchId: { in: ['branch-1', 'branch-2'] } } },
                { assignedTo: { branchId: { in: ['branch-1', 'branch-2'] } } },
              ],
            },
          ],
        },
      }),
    );
  });

  it('clamps getRecentRecords limit between 1 and 50', async () => {
    await service.getRecentRecords(500, {
      role: UserRole.SYSTEM_ADMIN,
      distributionId: null,
      branchId: null,
    });

    expect(prisma.installationRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 }),
    );
  });

  it('clamps getRecordsChart days and aggregates UTC date buckets', async () => {
    const todayKey = new Date().toISOString().slice(0, 10);
    prisma.installationRecord.findMany.mockResolvedValue([
      { id: 'ir-1', createdAt: new Date(`${todayKey}T12:00:00.000Z`) },
      { id: 'ir-2', createdAt: new Date(`${todayKey}T23:30:00.000Z`) },
    ]);

    const chart = await service.getRecordsChart(1000, {
      role: UserRole.SYSTEM_ADMIN,
      distributionId: null,
      branchId: null,
    });

    expect(chart).toHaveLength(366); // 365 days + today
    const todayBucket = chart.find((c) => c.date === todayKey);
    expect(todayBucket?.count).toBe(2);
  });
});
