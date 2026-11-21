import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { MailService } from './mail.service';

describe('MailService — Run 6 hardening', () => {
  function createMocks() {
    const prisma = {
      appSetting: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    };
    const config = { get: jest.fn((_k: string, def: string) => def) };
    const service = new MailService(
      config as unknown as ConfigService,
      prisma as unknown as PrismaService,
    );
    return { service, prisma };
  }

  it('rejects invalid Handlebars syntax in updateTemplate before saving', async () => {
    const { service, prisma } = createMocks();

    await expect(
      service.updateTemplate('installation-record-notification', '{{#if broken}}'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.appSetting.upsert).not.toHaveBeenCalled();
  });

  it('saves valid Handlebars template in updateTemplate', async () => {
    const { service, prisma } = createMocks();
    prisma.appSetting.upsert.mockResolvedValueOnce({ key: 'k', value: 'v' });

    const res = await service.updateTemplate(
      'installation-record-notification',
      '<p>Zapisnik {{recordNumber}}</p>',
    );

    expect(res.sourceType).toBe('db');
    expect(prisma.appSetting.upsert).toHaveBeenCalledTimes(1);
  });

  it('rejects empty recipient list in sendRecordWithPdf', async () => {
    const { service } = createMocks();

    await expect(
      service.sendRecordWithPdf({
        to: ['   ', ''],
        subject: 'Subj',
        recordNumber: 'REC-1',
        recordId: 'r-1',
        pdfBuffer: Buffer.from('pdf'),
        pdfFileName: 'rec.pdf',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
