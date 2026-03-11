import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/prisma/prisma.service';
import { StatusTransitionGuard } from './guards/status-transition.guard';
import { InstallationRecordsController } from './installation-records.controller';
import { InstallationRecordsService } from './installation-records.service';
import { PhotoUploadService } from './photo-upload.service';

describe('InstallationRecordsController', () => {
  let controller: InstallationRecordsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InstallationRecordsController],
      providers: [
        {
          provide: InstallationRecordsService,
          useValue: {},
        },
        {
          provide: PrismaService,
          useValue: {
            installationRecord: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: StatusTransitionGuard,
          useValue: { canActivate: jest.fn().mockResolvedValue(true) },
        },
        {
          provide: PhotoUploadService,
          useValue: { save: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<InstallationRecordsController>(InstallationRecordsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
