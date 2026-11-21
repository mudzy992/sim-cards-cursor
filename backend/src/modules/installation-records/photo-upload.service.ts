import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from '../settings/settings.service';
import { SETTINGS_KEYS } from '../settings/settings-keys';

@Injectable()
export class PhotoUploadService {
  private readonly logger = new Logger(PhotoUploadService.name);
  private readonly uploadsRoot: string;

  constructor(
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
  ) {
    this.uploadsRoot = this.config.get<string>(
      'UPLOAD_ROOT_PATH',
      path.join(process.cwd(), 'uploads'),
    );
  }

  private sanitizePathSegment(value: string): string {
    return value.replace(/[^a-zA-Z0-9-_]/g, '_');
  }

  private normalizeMime(m: string): string {
    const x = m.trim().toLowerCase();
    return x === 'image/jpg' ? 'image/jpeg' : x;
  }

  private parseAllowedMimes(raw: string): string[] {
    const parts = raw
      .split(',')
      .map((s) => this.normalizeMime(s))
      .filter(Boolean);
    const unique = [...new Set(parts)];
    return unique.length > 0 ? unique : ['image/jpeg', 'image/png'];
  }

  private async getPhotoUploadLimits(): Promise<{ maxBytes: number; allowedMimes: string[] }> {
    const rawMb = await this.settings.getNumber(SETTINGS_KEYS.uploadsMaxPhotoSizeMb, 5);
    const mb = Math.min(50, Math.max(1, rawMb));
    const rawList = await this.settings.getOptionalValue(SETTINGS_KEYS.uploadsAllowedPhotoMimeTypes);
    const allowedMimes = this.parseAllowedMimes(rawList ?? 'image/jpeg,image/png');
    return { maxBytes: mb * 1024 * 1024, allowedMimes };
  }

  async save(
    file: Express.Multer.File,
    opts: { serialNumber: string; year?: number | string | null },
  ): Promise<string> {
    if (!file) {
      throw new BadRequestException('Fajl nije pronađen.');
    }
    const serialNumber = (opts.serialNumber ?? '').trim();
    if (!serialNumber) {
      throw new BadRequestException('Nedostaje serijski broj brojila (serialNumber).');
    }
    const yearValue = opts.year ?? new Date().getFullYear();
    const year = String(
      typeof yearValue === 'number'
        ? yearValue
        : parseInt(String(yearValue), 10) || new Date().getFullYear(),
    );

    const buffer = file.buffer ?? (file.path ? fs.readFileSync(file.path) : null);
    if (!buffer) {
      throw new BadRequestException('Sadržaj fajla nije dostupan.');
    }
    const { maxBytes, allowedMimes } = await this.getPhotoUploadLimits();
    const normalizedMime = this.normalizeMime(file.mimetype ?? '');
    if (!allowedMimes.includes(normalizedMime)) {
      throw new BadRequestException(
        `Dozvoljeni formati: ${allowedMimes.join(', ')}. Primljen: ${file.mimetype}`,
      );
    }
    const size = file.size ?? buffer.length;
    if (size > maxBytes) {
      const mbLabel = (maxBytes / 1024 / 1024).toFixed(2);
      throw new BadRequestException(
        `Maksimalna veličina: ${mbLabel}MB. Primljeno: ${(size / 1024 / 1024).toFixed(2)}MB`,
      );
    }

    const mimetype = normalizedMime || 'image/jpeg';
    const ext = mimetype === 'image/png' ? '.png' : '.jpg';
    const sanitizedName = `${randomUUID()}${ext}`;
    const serial = this.sanitizePathSegment(serialNumber);
    const relativePath = path.posix.join(
      'installation-records',
      year,
      serial,
      'photos',
      sanitizedName,
    );
    const dir = path.join(this.uploadsRoot, 'installation-records', year, serial, 'photos');
    const fullPath = path.join(dir, sanitizedName);

    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(fullPath, buffer);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code === 'EACCES' || code === 'EPERM' || code === 'EROFS') {
        const uid = process.getuid?.();
        const gid = process.getgid?.();
        this.logger.error(
          `Cannot save photo to "${fullPath}" (${code}, uid=${uid}, gid=${gid}). ` +
            'Ensure the host uploads mount is writable by UID/GID 1000:1000 (chown -R 1000:1000 <host_uploads_dir>).',
        );
        throw new InternalServerErrorException(
          'Nije moguće sačuvati fotografiju na disk (nedovoljne dozvole na uploads direktoriju).',
        );
      }
      throw error;
    }

    return relativePath;
  }
}
