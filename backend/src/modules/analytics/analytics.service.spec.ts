import { Test, TestingModule } from '@nestjs/testing';
import { RecordStatus, SimCardStatus } from '@prisma/client';
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
    };
  };

  beforeEach(async () => {
    prisma = {
      installationRecord: {
        groupBy: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      simCard: {
        groupBy: jest.fn(),
      },
      meter: {
        count: jest.fn(),
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
});

