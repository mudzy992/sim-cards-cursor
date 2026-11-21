import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MobileAppPlatform } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  isStoragePermissionError,
  StorageInvalidPathError,
  UploadsStorageService,
} from 'src/common/storage/uploads-storage.service';

@Injectable()
export class AppReleasesService {
  private readonly storage: UploadsStorageService;
  private readonly graceDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Optional() storage?: UploadsStorageService,
  ) {
    this.storage = storage ?? new UploadsStorageService(this.config);
    this.graceDays = Number(this.config.get<string>('ANDROID_UPDATE_GRACE_DAYS') ?? '7');
  }

  async uploadAndroidRelease(input: {
    actorId: string;
    versionName: string;
    versionCode: number;
    releaseNotes?: string;
    file: Express.Multer.File;
  }) {
    const file = input.file;
    if (!file) throw new BadRequestException('Missing file');

    const originalName = (file.originalname ?? 'release.apk').replace(/[^\w.-]+/g, '_');
    if (!originalName.toLowerCase().endsWith('.apk')) {
      if (file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw new BadRequestException('Only .apk files are allowed');
    }

    const relDir = path.posix.join('app-releases', 'android');
    const fileBase = `${input.versionCode}_${Date.now()}_${originalName}`;
    const relPath = path.posix.join(relDir, fileBase);

    let sha256: string;
    try {
      if (file.path) {
        ({ sha256 } = await this.storage.moveLocalFile(file.path, relPath));
      } else if (file.buffer) {
        sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');
        this.storage.writeBuffer(relPath, file.buffer);
      } else {
        throw new BadRequestException('Uploaded file content is unavailable');
      }
    } catch (error) {
      if (isStoragePermissionError(error)) {
        throw new InternalServerErrorException(
          'Nije moguće sačuvati APK fajl na disk (nedovoljne dozvole na uploads direktoriju).',
        );
      }
      throw error;
    }

    const publishedAt = new Date();
    const mandatoryAfterAt = new Date(
      publishedAt.getTime() + this.graceDays * 24 * 60 * 60 * 1000,
    );

    const created = await this.prisma.mobileAppRelease.create({
      data: {
        platform: MobileAppPlatform.ANDROID,
        versionName: input.versionName,
        versionCode: input.versionCode,
        apkPath: path.posix.join(relDir, fileBase),
        apkFileName: originalName,
        apkSha256: sha256,
        releaseNotes: input.releaseNotes,
        publishedAt,
        mandatoryAfterAt,
        createdById: input.actorId,
      },
    });

    await this.prisma.activityLog.create({
      data: {
        userId: input.actorId,
        action: 'UPLOAD',
        entity: 'mobile_app_release',
        entityId: created.id,
        details: { versionName: created.versionName, versionCode: created.versionCode },
      },
    });

    return created;
  }

  async getLatestAndroidRelease() {
    const latest = await this.prisma.mobileAppRelease.findFirst({
      where: { platform: MobileAppPlatform.ANDROID },
      orderBy: [{ versionCode: 'desc' }, { publishedAt: 'desc' }],
    });
    if (!latest) return null;

    return {
      ...latest,
      downloadUrl: `/app-releases/android/download/${latest.id}`,
      graceDays: this.graceDays,
    };
  }

  async listAndroidReleases() {
    return this.prisma.mobileAppRelease.findMany({
      where: { platform: MobileAppPlatform.ANDROID },
      orderBy: [{ versionCode: 'desc' }, { publishedAt: 'desc' }],
    });
  }

  async getAndroidApkStream(id: string) {
    const release = await this.prisma.mobileAppRelease.findUnique({ where: { id } });
    if (!release || release.platform !== MobileAppPlatform.ANDROID) {
      throw new NotFoundException('Release not found');
    }

    const sanitized = release.apkPath.replace(/^\/+/, '').trim();
    if (!sanitized.startsWith('app-releases/android/')) {
      throw new NotFoundException('File not found');
    }

    let absolutePath: string;
    try {
      absolutePath = this.storage.resolvePath(sanitized);
    } catch (error) {
      if (error instanceof StorageInvalidPathError) {
        throw new NotFoundException('File not found');
      }
      throw error;
    }

    if (!this.storage.exists(sanitized)) {
      throw new NotFoundException('File not found');
    }

    return {
      release,
      stream: this.storage.createReadStream(sanitized),
      absolutePath,
    };
  }
}
