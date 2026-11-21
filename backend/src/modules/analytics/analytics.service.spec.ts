import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RecordStatus, SimCardStatus, UserRole } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
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
      groupBy: jest.Mock;
    };
    shipment: {
      findMany: jest.Mock;
    };
    branch: {
      findMany: jest.Mock;
    };
    user: {
      findMany: jest.Mock;
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
        groupBy: jest.fn().mockResolvedValue([]),
      },
      shipment: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      branch: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  it('calculates overview stats from grouped data', async () => {
    prisma.installationRecord.groupBy.mockResolvedValue([
      { status: RecordStatus.DRAFT, _count: { id: 2 } },
      { status: RecordStatus.SENT, _count: { id: 3 } },
    ]);
    prisma.installationRecord.count.mockResolvedValue(5);
    prisma.simCard.groupBy.mockResolvedValue([
      { status: SimCardStatus.AVAILABLE, _count: { id: 10 } },
      { status: SimCardStatus.INSTALLED, _count: { id: 5 } },
    ]);
    prisma.meter.count.mockResolvedValue(7);
    prisma.installationRecord.findMany.mockResolvedValue([
      {
        createdAt: new Date(Date.now() - 1_000),
        approvedAt: new Date(),
        sentAt: null,
      },
    ]);

    const result = await service.getOverview({ range: '7_DAYS' }, null);

    expect(result.installationRecords.total).toBe(5);
    expect(result.installationRecords.byStatus.DRAFT).toBe(2);
    expect(result.simCards.total).toBe(15);
    expect(result.metersTotal).toBe(7);
    expect(result.activationKpi.count).toBe(1);
  });

  it('scopes regular USER simCard analytics to assignedToId only', async () => {
    await service.getSimCardsAnalytics(
      { range: '30_DAYS' },
      {
        userId: 'op-1',
        role: UserRole.USER,
        distributionId: 'dist-1',
        branchId: 'branch-1',
        branchModeratorBranchIds: [],
      },
    );

    expect(prisma.simCard.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['status'],
        where: expect.objectContaining({
          AND: [{ assignedToId: 'op-1' }],
        }),
      }),
    );
  });

  it('aggregates simCards analytics via groupBy queries and id lookups', async () => {
    prisma.simCard.groupBy
      .mockResolvedValueOnce([{ status: SimCardStatus.INSTALLED, _count: { id: 4 } }])
      .mockResolvedValueOnce([{ shipmentId: 'ship-1', _count: { id: 4 } }])
      .mockResolvedValueOnce([
        { assignedToId: 'op-1', status: SimCardStatus.INSTALLED, _count: { id: 4 } },
      ]);
    prisma.meter.groupBy.mockResolvedValue([
      { branchId: 'branch-1', _count: { id: 4 } },
    ]);
    prisma.shipment.findMany.mockResolvedValue([
      { id: 'ship-1', distribution: { id: 'dist-1', name: 'EP Sarajevo' } },
    ]);
    prisma.branch.findMany.mockResolvedValue([
      { id: 'branch-1', name: 'Centar', distribution: { name: 'EP Sarajevo' } },
    ]);
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'op-1',
        firstName: 'Amir',
        lastName: 'Hadzic',
        branch: { name: 'Centar', distribution: { name: 'EP Sarajevo' } },
      },
    ]);

    const res = await service.getSimCardsAnalytics(
      { range: '30_DAYS' },
      { role: UserRole.SYSTEM_ADMIN, distributionId: null, branchId: null },
    );

    expect(res.byStatus[SimCardStatus.INSTALLED]).toBe(4);
    expect(res.byDistribution).toEqual([
      { distributionId: 'dist-1', distributionName: 'EP Sarajevo', total: 4 },
    ]);
    expect(res.byBranch).toEqual([
      {
        branchId: 'branch-1',
        branchName: 'Centar',
        distributionName: 'EP Sarajevo',
        installedCount: 4,
      },
    ]);
    expect(res.byOperator).toEqual([
      {
        userId: 'op-1',
        firstName: 'Amir',
        lastName: 'Hadzic',
        branchName: 'Centar',
        distributionName: 'EP Sarajevo',
        totalAssigned: 4,
        totalInstalled: 4,
      },
    ]);
  });

  it('forbids regular USER from accessing getUsersAnalytics and users.csv export', async () => {
    const regularUser = {
      userId: 'op-1',
      role: UserRole.USER,
      distributionId: 'dist-1',
      branchId: 'branch-1',
      branchModeratorBranchIds: [],
    };

    await expect(
      service.getUsersAnalytics({ range: '30_DAYS' }, regularUser),
    ).rejects.toThrow(ForbiddenException);

    await expect(
      service.getExportCsv('users', { range: '30_DAYS' }, regularUser),
    ).rejects.toThrow(ForbiddenException);
  });

  it('uses groupBy and userScope filter in getUsersAnalytics and escapes CSV with BOM', async () => {
    prisma.installationRecord.groupBy
      .mockResolvedValueOnce([{ installedById: 'u-1', _count: { id: 6 } }])
      .mockResolvedValueOnce([{ approvedById: 'u-1', _count: { id: 2 } }]);
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'u-1',
        firstName: '=CMD()',
        lastName: 'Čović',
        email: 'covic@ep.ba',
        role: UserRole.USER,
      },
    ]);

    const distAdmin = {
      userId: 'admin-1',
      role: UserRole.DIST_ADMIN,
      distributionId: 'dist-1',
      branchId: null,
    };

    const { content } = await service.getExportCsv(
      'users',
      { range: '30_DAYS' },
      distAdmin,
    );

    expect(content.startsWith('\uFEFF')).toBe(true);
    expect(content).toContain("'=CMD()");
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: [
            {
              OR: [
                { distributionId: 'dist-1' },
                { branch: { distributionId: 'dist-1' } },
              ],
            },
          ],
        }),
      }),
    );
  });

  it('rejects CUSTOM ranges longer than 366 days', async () => {
    await expect(
      service.getOverview(
        {
          range: 'CUSTOM',
          from: '2025-01-01T00:00:00.000Z',
          to: '2026-06-01T00:00:00.000Z',
        },
        { role: UserRole.SYSTEM_ADMIN, distributionId: null, branchId: null },
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
