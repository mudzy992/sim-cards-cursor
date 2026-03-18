import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MobileAppPlatform } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

@Injectable()
export class AppReleasesService {
  private readonly uploadsDir: string;
  private readonly graceDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const root = this.config.get<string>(
      'UPLOAD_ROOT_PATH',
      path.join(process.cwd(), 'uploads'),
    );
    this.uploadsDir = root;
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

    const originalName = (file.originalname ?? 'release.apk').replace(/[^\w.\-]+/g, '_');
    if (!originalName.toLowerCase().endsWith('.apk')) {
      throw new BadRequestException('Only .apk files are allowed');
    }

    const relDir = path.posix.join('app-releases', 'android');
    const absDir = path.join(this.uploadsDir, relDir);
    fs.mkdirSync(absDir, { recursive: true });

    const fileBase = `${input.versionCode}_${Date.now()}_${originalName}`;
    const absPath = path.join(absDir, fileBase);

    const sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');
    fs.writeFileSync(absPath, file.buffer);

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

    const sanitized = release.apkPath.replace(/\.\./g, '').replace(/^\/+/, '').trim();
    if (!sanitized.startsWith('app-releases/android/')) {
      throw new NotFoundException('File not found');
    }

    const fullPath = path.join(this.uploadsDir, sanitized);
    const resolved = path.resolve(fullPath);
    if (!fs.existsSync(resolved) || !resolved.startsWith(path.resolve(this.uploadsDir))) {
      throw new NotFoundException('File not found');
    }

    return {
      release,
      stream: fs.createReadStream(resolved),
      absolutePath: resolved,
    };
  }
}

