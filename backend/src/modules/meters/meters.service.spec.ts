import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/prisma/prisma.service';
import { MetersService } from './meters.service';

describe('MetersService', () => {
  let service: MetersService;
  let prisma: Partial<PrismaService>;

  beforeEach(async () => {
    prisma = {
      meter: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      } as any,
      $transaction: jest.fn().mockImplementation((operations: any[]) =>
        Promise.all(operations.map((op) => op)),
      ),
    } as Partial<PrismaService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetersService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<MetersService>(MetersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
