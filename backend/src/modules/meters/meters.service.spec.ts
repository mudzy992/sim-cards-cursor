import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { MeterSimCardState, MeterStatus, UserRole } from '@prisma/client';
import { UploadsStorageService } from 'src/common/storage/uploads-storage.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { AuthService } from '../auth/auth.service';
import { MeterTypeFieldsService } from '../meter-type-definitions/meter-type-fields.service';
import { MetersService } from './meters.service';

describe('MetersService — Run 3 security, integrity & scope', () => {
  let service: MetersService;
  let prisma: {
    meter: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      deleteMany: jest.Mock;
    };
    branch: { findUnique: jest.Mock };
    meterTypeDefinition: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let activityLogService: { log: jest.Mock };

  beforeEach(async () => {
    prisma = {
      meter: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      branch: {
        findUnique: jest.fn().mockResolvedValue({ id: 'branch-1', distributionId: 'dist-1' }),
      },
      meterTypeDefinition: {
        findUnique: jest.fn().mockResolvedValue({ id: 'type-1' }),
      },
      $transaction: jest.fn().mockImplementation((operations: Promise<unknown>[]) =>
        Promise.all(operations),
      ),
    };

    activityLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetersService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: MeterTypeFieldsService,
          useValue: { validateDynamicValues: jest.fn().mockResolvedValue({}) },
        },
        {
          provide: AuthService,
          useValue: { verifyPassword: jest.fn().mockResolvedValue({ verified: true }) },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(undefined) },
        },
        {
          provide: ActivityLogService,
          useValue: activityLogService,
        },
        {
          provide: UploadsStorageService,
          useValue: { removeDirRecursive: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<MetersService>(MetersService);
  });

  it('trims serialNumber, rejects duplicate serialNumber with ConflictException, and logs CREATE', async () => {
    prisma.meter.findUnique.mockResolvedValueOnce(null);
    prisma.meter.create.mockResolvedValueOnce({
      id: 'meter-1',
      serialNumber: 'AMM-1001',
      meterTypeDefinitionId: 'type-1',
      branchId: 'branch-1',
    });

    const created = await service.create(
      {
        serialNumber: '  AMM-1001  ',
        meterTypeDefinitionId: 'type-1',
        branchId: 'branch-1',
        year: 2025,
        calibrationYear: 2026,
      },
      { role: UserRole.SYSTEM_ADMIN, distributionId: null, branchId: null },
      'admin-1',
      '127.0.0.1',
    );

    expect(created.serialNumber).toBe('AMM-1001');
    expect(prisma.meter.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ serialNumber: 'AMM-1001' }),
      }),
    );
    expect(activityLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CREATE', entity: 'meter', entityId: 'meter-1' }),
    );

    prisma.meter.findUnique.mockResolvedValueOnce({ id: 'existing-meter' });
    await expect(
      service.create({
        serialNumber: 'AMM-1001',
        meterTypeDefinitionId: 'type-1',
        year: 2025,
        calibrationYear: 2026,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects missing meterTypeDefinitionId with NotFoundException', async () => {
    prisma.meterTypeDefinition.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.create({
        serialNumber: 'AMM-2002',
        meterTypeDefinitionId: 'missing-type',
        year: 2025,
        calibrationYear: 2026,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('blocks direct simCardId/simCardState updates and cross-distribution branchId reassignment on update', async () => {
    await expect(
      service.update('meter-1', {
        simCardId: 'sim-1',
        simCardState: MeterSimCardState.INSTALLED,
      }),
    ).rejects.toThrow(BadRequestException);

    prisma.meter.findFirst.mockResolvedValueOnce({
      id: 'meter-1',
      serialNumber: 'AMM-1001',
      year: 2025,
      calibrationYear: 2026,
      meterTypeDefinitionId: 'type-1',
    });
    prisma.branch.findUnique.mockResolvedValueOnce({
      id: 'branch-other-dist',
      distributionId: 'dist-2',
    });

    await expect(
      service.update(
        'meter-1',
        { branchId: 'branch-other-dist', status: MeterStatus.ACTIVE },
        { role: UserRole.DIST_ADMIN, distributionId: 'dist-1', branchId: null },
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('scopes BranchModerator reads strictly to moderated branches instead of whole distribution', async () => {
    const moderatorScope = {
      role: UserRole.USER,
      distributionId: 'dist-1',
      branchId: 'branch-1',
      branchModeratorBranchIds: ['branch-2', 'branch-1'],
    };

    await service.findAll(
      { page: 1, limit: 20, status: MeterStatus.ACTIVE, branchId: 'branch-2' },
      moderatorScope,
    );

    expect(prisma.meter.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: MeterStatus.ACTIVE,
          branchId: 'branch-2',
          AND: [{ branchId: { in: ['branch-1', 'branch-2'] } }],
        }),
      }),
    );

    await service.findAvailable(moderatorScope, { search: 'AMM', limit: 999 });
    expect(prisma.meter.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        take: 500,
        where: expect.objectContaining({
          AND: [{ branchId: { in: ['branch-1', 'branch-2'] } }],
          serialNumber: { contains: 'AMM', mode: 'insensitive' },
        }),
      }),
    );
  });
});
