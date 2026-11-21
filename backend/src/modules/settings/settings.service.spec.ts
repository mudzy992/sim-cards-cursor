import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { SETTINGS_KEYS } from './settings-keys';
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  let service: SettingsService;
  let prisma: {
    appSetting: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      upsert: jest.Mock;
      update: jest.Mock;
    };
  };
  let activityLogService: { log: jest.Mock };

  beforeEach(async () => {
    prisma = {
      appSetting: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn(),
        update: jest.fn(),
      },
    };
    activityLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ActivityLogService, useValue: activityLogService },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
  });

  it('masks sensitive keys and excludes per-user tour keys in findAll', async () => {
    prisma.appSetting.findMany.mockResolvedValue([
      { id: '1', key: SETTINGS_KEYS.smtpPass, value: 'super-secret', description: null },
      { id: '2', key: SETTINGS_KEYS.smtpHost, value: 'smtp.example.com', description: null },
    ]);

    const res = await service.findAll();

    expect(prisma.appSetting.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { NOT: { key: { startsWith: 'user:tour-state:' } } },
      }),
    );
    expect(res[0].value).toBe('••••••••');
    expect(res[1].value).toBe('smtp.example.com');
  });

  it('redacts sensitive setting values in upsert response and ActivityLog details', async () => {
    prisma.appSetting.findUnique.mockResolvedValue({
      id: '1',
      key: SETTINGS_KEYS.smtpPass,
      value: 'old-pass',
      description: null,
    });
    prisma.appSetting.upsert.mockResolvedValue({
      id: '1',
      key: SETTINGS_KEYS.smtpPass,
      value: 'new-pass',
      description: null,
    });

    const result = await service.upsert(
      SETTINGS_KEYS.smtpPass,
      { value: 'new-pass' },
      { userId: 'admin-1' },
    );

    expect(result.value).toBe('••••••••');
    expect(activityLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({
          key: SETTINGS_KEYS.smtpPass,
          oldValue: '••••••••',
          newValue: '••••••••',
        }),
      }),
    );
  });

  it('blocks direct access to user:tour-state:* keys via public key endpoints', async () => {
    await expect(
      service.findPublicSettingByKey('user:tour-state:user-1'),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.upsertPublicSetting('user:tour-state:user-1', { value: '{}' }),
    ).rejects.toThrow(BadRequestException);
  });
});
