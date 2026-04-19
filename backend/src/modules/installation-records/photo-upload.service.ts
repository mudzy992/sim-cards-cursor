import { Injectable, BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from '../settings/settings.service';
import { SETTINGS_KEYS } from '../settings/settings-keys';

@Injectable()
export class PhotoUploadService {
  private readonly uploadDir: string;

  constructor(
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
  ) {
    const root = this.config.get<string>('UPLOAD_ROOT_PATH', path.join(process.cwd(), 'uploads'));
    this.uploadDir = path.join(root, 'installation-records');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
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

  async save(file: Express.Multer.File): Promise<string> {
    if (!file) {
      throw new BadRequestException('Fajl nije pronađen.');
    }
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
    const relativePath = `installation-records/${sanitizedName}`;
    const fullPath = path.join(this.uploadDir, sanitizedName);

    fs.writeFileSync(fullPath, buffer);

    return relativePath;
  }
}
