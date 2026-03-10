import { Test, TestingModule } from '@nestjs/testing';
import { InstallationRecordsController } from './installation-records.controller';

describe('InstallationRecordsController', () => {
  let controller: InstallationRecordsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InstallationRecordsController],
    }).compile();

    controller = module.get<InstallationRecordsController>(InstallationRecordsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
