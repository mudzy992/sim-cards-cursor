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

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04] as const;

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

  private hasZipMagicBytes(file: Express.Multer.File): boolean {
    if (file.buffer) {
      if (file.buffer.length < 4) return false;
      return ZIP_MAGIC.every((byte, idx) => file.buffer[idx] === byte);
    }

    if (file.path && fs.existsSync(file.path)) {
      const header = Buffer.alloc(4);
      const fd = fs.openSync(file.path, 'r');
      try {
        const bytesRead = fs.readSync(fd, header, 0, 4, 0);
        if (bytesRead < 4) return false;
        return ZIP_MAGIC.every((byte, idx) => header[idx] === byte);
      } finally {
        fs.closeSync(fd);
      }
    }

    return false;
  }

  private cleanupTempFile(filePath?: string): void {
    if (!filePath) return;
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // ignore cleanup errors
    }
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

    try {
      const originalName = (file.originalname ?? 'release.apk').replace(/[^\w.-]+/g, '_');
      if (!originalName.toLowerCase().endsWith('.apk')) {
        throw new BadRequestException('Only .apk files are allowed');
      }

      if (!this.hasZipMagicBytes(file)) {
        throw new BadRequestException('Invalid APK archive signature');
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
          apkPath: relPath,
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
    } finally {
      this.cleanupTempFile(file.path);
    }
  }

  async getLatestAndroidRelease() {
    const latest = await this.prisma.mobileAppRelease.findFirst({
      where: { platform: MobileAppPlatform.ANDROID },
      orderBy: [{ versionCode: 'desc' }, { publishedAt: 'desc' }],
    });
    if (!latest) return null;

    return {
      id: latest.id,
      platform: latest.platform,
      versionName: latest.versionName,
      versionCode: latest.versionCode,
      apkFileName: latest.apkFileName,
      apkSha256: latest.apkSha256,
      releaseNotes: latest.releaseNotes,
      publishedAt: latest.publishedAt,
      mandatoryAfterAt: latest.mandatoryAfterAt,
      createdAt: latest.createdAt,
      updatedAt: latest.updatedAt,
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

    let contentLength: number | undefined;
    try {
      contentLength = fs.statSync(absolutePath).size;
    } catch {
      contentLength = undefined;
    }

    return {
      release,
      stream: this.storage.createReadStream(sanitized),
      absolutePath,
      contentLength,
    };
  }
}
