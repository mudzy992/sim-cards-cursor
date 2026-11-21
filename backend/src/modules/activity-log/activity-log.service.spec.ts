import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from './activity-log.service';

describe('ActivityLogService', () => {
  let service: ActivityLogService;
  let prisma: {
    activityLog: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      activityLog: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn().mockResolvedValue([[], 0]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityLogService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ActivityLogService>(ActivityLogService);
  });

  it('fails closed when DIST_ADMIN lacks distributionId or when role is USER', async () => {
    const noDistResult = await service.findAll(
      { page: 1, limit: 20 },
      { role: UserRole.DIST_ADMIN, distributionId: null, branchId: null },
    );
    expect(noDistResult.items).toEqual([]);
    expect(prisma.$transaction).not.toHaveBeenCalled();

    const userResult = await service.findAll(
      { page: 1, limit: 20 },
      { role: UserRole.USER, distributionId: 'dist-1', branchId: 'branch-1' },
    );
    expect(userResult.items).toEqual([]);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('scopes DIST_ADMIN activity logs to users in their distribution with case-insensitive filters', async () => {
    await service.findAll(
      { page: 1, limit: 10, action: 'update', entity: 'meter' },
      { role: UserRole.DIST_ADMIN, distributionId: 'dist-1', branchId: null },
    );

    expect(prisma.activityLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          user: {
            OR: [
              { distributionId: 'dist-1' },
              { branch: { distributionId: 'dist-1' } },
            ],
          },
          action: { contains: 'update', mode: 'insensitive' },
          entity: { contains: 'meter', mode: 'insensitive' },
        }),
      }),
    );
  });
});
