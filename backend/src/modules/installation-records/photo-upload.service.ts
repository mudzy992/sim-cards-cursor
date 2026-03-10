import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/jpg'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

@Injectable()
export class PhotoUploadService {
  private readonly uploadDir = path.join(process.cwd(), 'uploads', 'installation-records');

  constructor() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async save(file: Express.Multer.File): Promise<string> {
    if (!file) {
      throw new BadRequestException('Fajl nije pronađen.');
    }
    const buffer = file.buffer ?? (file.path ? fs.readFileSync(file.path) : null);
    if (!buffer) {
      throw new BadRequestException('Sadržaj fajla nije dostupan.');
    }
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Dozvoljeni formati: JPEG, PNG. Primljen: ${file.mimetype}`,
      );
    }
    const size = file.size ?? buffer.length;
    if (size > MAX_SIZE_BYTES) {
      throw new BadRequestException(
        `Maksimalna veličina: 5MB. Primljeno: ${(size / 1024 / 1024).toFixed(2)}MB`,
      );
    }

    const mimetype = file.mimetype ?? 'image/jpeg';
    const ext = mimetype === 'image/png' ? '.png' : '.jpg';
    const sanitizedName = `${randomUUID()}${ext}`;
    const relativePath = `installation-records/${sanitizedName}`;
    const fullPath = path.join(this.uploadDir, sanitizedName);

    fs.writeFileSync(fullPath, buffer);

    return relativePath;
  }
}
