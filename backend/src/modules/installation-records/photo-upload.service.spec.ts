import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PhotoUploadService } from './photo-upload.service';
import { SettingsService } from '../settings/settings.service';

describe('PhotoUploadService', () => {
  let tempRoot: string;
  let service: PhotoUploadService;
  let settingsMock: { getNumber: jest.Mock; getOptionalValue: jest.Mock };

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sim-photo-upload-'));
    settingsMock = {
      getNumber: jest.fn().mockResolvedValue(5),
      getOptionalValue: jest.fn().mockResolvedValue('image/jpeg,image/png,image/webp'),
    };
    service = new PhotoUploadService(
      { get: jest.fn(() => tempRoot) } as unknown as ConfigService,
      settingsMock as unknown as SettingsService,
    );
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('rejects text/script masquerading as image/jpeg', async () => {
    const fakeFile = {
      mimetype: 'image/jpeg',
      buffer: Buffer.from('<html><script>alert(1)</script></html>'),
      size: 38,
    } as Express.Multer.File;

    await expect(
      service.save(fakeFile, { serialNumber: 'SN-100', year: 2026 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts valid JPEG, PNG, and WEBP magic bytes', async () => {
    const jpeg = {
      mimetype: 'image/jpeg',
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
      size: 6,
    } as Express.Multer.File;
    const png = {
      mimetype: 'image/png',
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]),
      size: 9,
    } as Express.Multer.File;
    const webp = {
      mimetype: 'image/webp',
      buffer: Buffer.concat([
        Buffer.from('RIFF', 'ascii'),
        Buffer.from([0x00, 0x00, 0x00, 0x00]),
        Buffer.from('WEBP', 'ascii'),
      ]),
      size: 12,
    } as Express.Multer.File;

    const jpegPath = await service.save(jpeg, { serialNumber: 'SN-100', year: 2026 });
    const pngPath = await service.save(png, { serialNumber: 'SN-100', year: 2026 });
    const webpPath = await service.save(webp, { serialNumber: 'SN-100', year: 2026 });

    expect(jpegPath).toMatch(/^installation-records\/2026\/SN-100\/photos\/.*\.jpg$/);
    expect(pngPath).toMatch(/^installation-records\/2026\/SN-100\/photos\/.*\.png$/);
    expect(webpPath).toMatch(/^installation-records\/2026\/SN-100\/photos\/.*\.webp$/);
    expect(fs.existsSync(path.join(tempRoot, jpegPath))).toBe(true);
    expect(fs.existsSync(path.join(tempRoot, pngPath))).toBe(true);
    expect(fs.existsSync(path.join(tempRoot, webpPath))).toBe(true);
  });
});
