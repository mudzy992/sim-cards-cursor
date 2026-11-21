import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MobileAppPlatform } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

@Injectable()
export class AppReleasesService {
  private readonly logger = new Logger(AppReleasesService.name);
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

  private async computeFileSha256(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
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
    const absDir = path.join(this.uploadsDir, relDir);
    const fileBase = `${input.versionCode}_${Date.now()}_${originalName}`;
    const absPath = path.join(absDir, fileBase);

    let sha256: string;
    try {
      fs.mkdirSync(absDir, { recursive: true });

      if (file.path) {
        sha256 = await this.computeFileSha256(file.path);
        try {
          fs.renameSync(file.path, absPath);
        } catch {
          fs.copyFileSync(file.path, absPath);
          fs.unlinkSync(file.path);
        }
      } else if (file.buffer) {
        sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');
        fs.writeFileSync(absPath, file.buffer);
      } else {
        throw new BadRequestException('Uploaded file content is unavailable');
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code === 'EACCES' || code === 'EPERM' || code === 'EROFS') {
        const uid = process.getuid?.();
        const gid = process.getgid?.();
        this.logger.error(
          `Cannot save APK release to "${absPath}" (${code}, uid=${uid}, gid=${gid}). ` +
            'Ensure the host uploads mount is writable by UID/GID 1000:1000 (chown -R 1000:1000 <host_uploads_dir>).',
        );
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
