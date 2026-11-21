import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Optional,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from '../settings/settings.service';
import { SETTINGS_KEYS } from '../settings/settings-keys';
import {
  isStoragePermissionError,
  UploadsStorageService,
} from 'src/common/storage/uploads-storage.service';

@Injectable()
export class PhotoUploadService {
  private readonly storage: UploadsStorageService;

  constructor(
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
    @Optional() storage?: UploadsStorageService,
  ) {
    this.storage = storage ?? new UploadsStorageService(this.config);
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

  private hasValidImageMagicBytes(buffer: Buffer, mime: string): boolean {
    if (mime === 'image/jpeg') {
      return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    }
    if (mime === 'image/png') {
      return (
        buffer.length >= 8 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a
      );
    }
    if (mime === 'image/webp') {
      return (
        buffer.length >= 12 &&
        buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
        buffer.subarray(8, 12).toString('ascii') === 'WEBP'
      );
    }
    return true;
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
    if (!this.hasValidImageMagicBytes(buffer, normalizedMime)) {
      throw new BadRequestException(
        'Sadržaj fajla ne odgovara deklarisanom formatu slike (JPEG/PNG).',
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
    const ext =
      mimetype === 'image/png'
        ? '.png'
        : mimetype === 'image/webp'
          ? '.webp'
          : '.jpg';
    const sanitizedName = `${randomUUID()}${ext}`;
    const serial = this.sanitizePathSegment(serialNumber);
    const relativePath = path.posix.join(
      'installation-records',
      year,
      serial,
      'photos',
      sanitizedName,
    );

    try {
      this.storage.writeBuffer(relativePath, buffer);
    } catch (error) {
      if (isStoragePermissionError(error)) {
        throw new InternalServerErrorException(
          'Nije moguće sačuvati fotografiju na disk (nedovoljne dozvole na uploads direktoriju).',
        );
      }
      throw error;
    }

    return relativePath;
  }
}
