import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { MeterTypeFieldsService } from '../meter-type-definitions/meter-type-fields.service';
import { AuthService } from '../auth/auth.service';
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
      ],
    }).compile();

    service = module.get<MetersService>(MetersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
