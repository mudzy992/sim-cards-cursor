import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { MobileAppPlatform } from '@prisma/client';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { UploadsStorageService } from 'src/common/storage/uploads-storage.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AppReleasesService } from './app-releases.service';

describe('AppReleasesService', () => {
  let service: AppReleasesService;
  let prisma: {
    mobileAppRelease: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
    };
    activityLog: {
      create: jest.Mock;
    };
  };
  let storage: {
    moveLocalFile: jest.Mock;
    writeBuffer: jest.Mock;
    resolvePath: jest.Mock;
    exists: jest.Mock;
    createReadStream: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      mobileAppRelease: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      activityLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    storage = {
      moveLocalFile: jest.fn().mockResolvedValue({ sha256: 'abc123' }),
      writeBuffer: jest.fn(),
      resolvePath: jest.fn().mockReturnValue('/tmp/fake.apk'),
      exists: jest.fn().mockReturnValue(true),
      createReadStream: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppReleasesService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('7') },
        },
        { provide: UploadsStorageService, useValue: storage },
      ],
    }).compile();

    service = module.get<AppReleasesService>(AppReleasesService);
  });

  it('rejects .apk uploads without ZIP magic bytes and cleans up temp file', async () => {
    const tmpFile = path.join(os.tmpdir(), `bad-apk-${Date.now()}.apk`);
    fs.writeFileSync(tmpFile, 'not-a-zip-file');

    await expect(
      service.uploadAndroidRelease({
        actorId: 'admin-1',
        versionName: '1.0.0',
        versionCode: 10,
        file: {
          originalname: 'app.apk',
          path: tmpFile,
        } as Express.Multer.File,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(fs.existsSync(tmpFile)).toBe(false);
  });

  it('accepts valid APK/ZIP signature and omits internal apkPath & createdById from public metadata', async () => {
    prisma.mobileAppRelease.findFirst.mockResolvedValue({
      id: 'rel-1',
      platform: MobileAppPlatform.ANDROID,
      versionName: '2.0.0',
      versionCode: 20,
      apkPath: 'app-releases/android/20_app.apk',
      apkFileName: 'app.apk',
      apkSha256: 'deadbeef',
      releaseNotes: 'Fixes',
      publishedAt: new Date('2026-11-20T00:00:00.000Z'),
      mandatoryAfterAt: new Date('2026-11-27T00:00:00.000Z'),
      createdById: 'admin-uuid',
      createdAt: new Date('2026-11-20T00:00:00.000Z'),
      updatedAt: new Date('2026-11-20T00:00:00.000Z'),
    });

    const latest = await service.getLatestAndroidRelease();

    expect(latest).not.toBeNull();
    expect(latest).not.toHaveProperty('apkPath');
    expect(latest).not.toHaveProperty('createdById');
    expect(latest?.downloadUrl).toBe('/app-releases/android/download/rel-1');
  });

  it('rejects APK download outside app-releases/android prefix', async () => {
    prisma.mobileAppRelease.findUnique.mockResolvedValue({
      id: 'rel-bad',
      platform: MobileAppPlatform.ANDROID,
      apkPath: '../../etc/passwd',
    });

    await expect(service.getAndroidApkStream('rel-bad')).rejects.toThrow(
      NotFoundException,
    );
  });
});
