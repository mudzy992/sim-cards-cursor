import { BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Test, TestingModule } from '@nestjs/testing';
import { InstallationRecordKind, RecordStatus, UserRole } from '@prisma/client';
import { RecordNumberGenerator } from 'src/common/utils/record-number.generator';
import { PdfGeneratorService } from 'src/common/utils/pdf-generator.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { MailService } from '../mail/mail.service';
import { MeterTypeFieldsService } from '../meter-type-definitions/meter-type-fields.service';
import { InstallationRecordsService } from './installation-records.service';
import { ConfigService } from '@nestjs/config';

const mockRecord = {
  id: 'rec-1',
  recordNumber: 'REC-001',
  meterId: 'meter-1',
  installedById: 'user-1',
  status: RecordStatus.DRAFT,
  approvedById: null,
  approvedAt: null,
  rejectionReason: null,
  sentToEmail: null,
  sentAt: null,
  pdfPath: null,
  notes: null,
  photos: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  meter: {
    id: 'meter-1',
    branchId: 'branch-1',
    serialNumber: 'SN-001',
    simCard: null,
    meterTypeDefinition: { name: 'Type A', manufacturer: null, model: null, type: 'SINGLE_PHASE', maxCurrent: null },
  },
  installedBy: { firstName: 'Test', lastName: 'User' },
  approvedBy: null,
};

type PrismaMockShape = {
  $transaction: jest.Mock;
  installationRecord: {
    findMany: jest.Mock;
    count: jest.Mock;
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
  };
  meter: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  meterTypeDefinition: { findUnique: jest.Mock };
  simCard: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  simEvent: { create: jest.Mock };
  branchModerator: { findUnique: jest.Mock; findMany: jest.Mock };
  branchEmailRecipient: { findMany: jest.Mock };
  user: { findFirst: jest.Mock };
  branch: { findUnique: jest.Mock };
  installTask: { updateMany: jest.Mock };
};

describe('InstallationRecordsService', () => {
  let service: InstallationRecordsService;
  let prismaMock: PrismaMockShape;

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn((args) => {
        if (Array.isArray(args)) return Promise.resolve(args);
        return (args as (tx: PrismaMockShape) => unknown)(prismaMock);
      }),
      installationRecord: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      meter: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      meterTypeDefinition: { findUnique: jest.fn() },
      simCard: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      simEvent: { create: jest.fn() },
      branchModerator: { findUnique: jest.fn(), findMany: jest.fn() },
      branchEmailRecipient: { findMany: jest.fn() },
      user: { findFirst: jest.fn() },
      branch: { findUnique: jest.fn() },
      installTask: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InstallationRecordsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RecordNumberGenerator, useValue: { generate: jest.fn().mockResolvedValue('REC-001') } },
        { provide: PdfGeneratorService, useValue: { generatePdf: jest.fn().mockResolvedValue(Buffer.from('pdf')) } },
        { provide: ActivityLogService, useValue: { log: jest.fn() } },
        { provide: MailService, useValue: { sendRecordWithPdf: jest.fn().mockResolvedValue(undefined) } },
        { provide: MeterTypeFieldsService, useValue: { validateDynamicValues: jest.fn().mockResolvedValue({}), findAllByDefinition: jest.fn().mockResolvedValue([]) } },
        { provide: ConfigService, useValue: { get: jest.fn((_k: string, def: string) => def) } },
      ],
    }).compile();

    service = module.get<InstallationRecordsService>(InstallationRecordsService);
  });

  describe('RBAC scope filtering', () => {
    it('blocks USER list access when user has no branch scope', async () => {
      await expect(
        service.findAll(
          { page: 1, limit: 20 } as never,
          { role: UserRole.USER, distributionId: null, branchId: null },
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('markSepActivated', () => {
    it('rejects when status is not SENT', async () => {
      const draftRecord = { ...mockRecord, status: RecordStatus.DRAFT };
      prismaMock.installationRecord.findFirst.mockResolvedValue(draftRecord);

      await expect(
        service.markSepActivated('rec-1', { userId: 'user-1' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('allows DIST_ADMIN to mark SENT record as SEP_ACTIVATED', async () => {
      const sentRecord = { ...mockRecord, status: RecordStatus.SENT };
      prismaMock.installationRecord.findFirst.mockResolvedValue(sentRecord);
      prismaMock.installationRecord.update.mockResolvedValue({
        ...sentRecord,
        status: RecordStatus.SEP_ACTIVATED,
      });
      prismaMock.installationRecord.findUnique.mockResolvedValue(sentRecord);

      const result = await service.markSepActivated(
        'rec-1',
        { userId: 'admin-1' },
        { role: UserRole.DIST_ADMIN, distributionId: 'dist-1', branchId: null },
      );

      expect(result.status).toBe(RecordStatus.SEP_ACTIVATED);
    });

    it('blocks USER who is not branch moderator', async () => {
      const sentRecord = { ...mockRecord, status: RecordStatus.SENT };
      prismaMock.installationRecord.findFirst.mockResolvedValue(sentRecord);
      prismaMock.meter.findUnique.mockResolvedValue({ branchId: 'branch-1' });
      prismaMock.branchModerator.findUnique.mockResolvedValue(null);

      await expect(
        service.markSepActivated(
          'rec-1',
          { userId: 'user-1' },
          { role: UserRole.USER, distributionId: null, branchId: 'branch-1' },
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('retrySendEmail', () => {
    it('rejects when status is not SEND_FAILED', async () => {
      const sentRecord = { ...mockRecord, status: RecordStatus.SENT };
      prismaMock.installationRecord.findFirst.mockResolvedValue(sentRecord);

      await expect(
        service.retrySendEmail('rec-1', { userId: 'user-1' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('create', () => {
    it('rejects NEW_CONNECTION when demountedMeter is present', async () => {
      prismaMock.installationRecord.findUnique.mockResolvedValue(null);

      await expect(
        service.create({
          simCardId: 'sim-1',
          installedById: 'user-1',
          kind: InstallationRecordKind.NEW_CONNECTION,
          demountedMeter: {
            meterTypeDefinitionId: 'type-old',
            serialNumber: 'OLD-1',
            year: 2010,
            calibrationYear: 2015,
          } as never,
          meterTypeDefinitionId: 'type-new',
          serialNumber: 'NEW-1',
          year: 2024,
          calibrationYear: 2025,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates installation record for METER_REPLACEMENT with snapshot', async () => {
      prismaMock.installationRecord.findUnique.mockResolvedValue(null);
      prismaMock.meterTypeDefinition.findUnique.mockImplementation((args: { where: { id: string } }) =>
        Promise.resolve({ id: args.where.id, name: 'Type' }),
      );
      prismaMock.meter.findUnique.mockResolvedValue(null);
      prismaMock.meter.create.mockResolvedValue({ id: 'meter-new' });
      prismaMock.simCard.findFirst.mockResolvedValue({
        id: 'sim-1',
        status: 'AVAILABLE',
        assignedToId: null,
      });
      prismaMock.simCard.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.installationRecord.create.mockResolvedValue({
        id: 'rec-x',
        recordNumber: 'REC-001',
        kind: InstallationRecordKind.METER_REPLACEMENT,
        demountedMeterSnapshot: { serialNumber: 'OLD-1' },
        meterId: 'meter-new',
        installedById: 'user-1',
        status: RecordStatus.DRAFT,
      });

      const dto = {
        simCardId: 'sim-1',
        installedById: 'user-1',
        kind: InstallationRecordKind.METER_REPLACEMENT,
        demountedMeter: {
          meterTypeDefinitionId: 'type-old',
          serialNumber: 'OLD-1',
          year: 2010,
          calibrationYear: 2015,
        },
        meterTypeDefinitionId: 'type-new',
        serialNumber: 'NEW-1',
        year: 2024,
        calibrationYear: 2025,
      };

      const result = await service.create(dto as never);

      expect(prismaMock.installationRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            kind: InstallationRecordKind.METER_REPLACEMENT,
            demountedMeterSnapshot: expect.objectContaining({
              serialNumber: 'OLD-1',
              year: 2010,
              calibrationYear: 2015,
            }),
            meterId: 'meter-new',
          }),
        }),
      );
      expect(result.id).toBe('rec-x');
    });
  });

  describe('getPermissions', () => {
    it('returns canRetrySend=true for SEND_FAILED record when user is creator', async () => {
      const failedRecord = { ...mockRecord, status: RecordStatus.SEND_FAILED };
      prismaMock.installationRecord.findFirst.mockResolvedValue(failedRecord);

      const perms = await service.getPermissions(
        'rec-1',
        'user-1',
        { role: UserRole.USER, distributionId: null, branchId: 'branch-1' },
      );

      expect(perms.canRetrySend).toBe(true);
      expect(perms.canMarkSepActivated).toBe(false);
    });

    it('returns canMarkSepActivated=true for SENT record when user is DIST_ADMIN', async () => {
      const sentRecord = { ...mockRecord, status: RecordStatus.SENT };
      prismaMock.installationRecord.findFirst.mockResolvedValue(sentRecord);

      const perms = await service.getPermissions(
        'rec-1',
        'admin-1',
        { role: UserRole.DIST_ADMIN, distributionId: 'dist-1', branchId: null },
      );

      expect(perms.canRetrySend).toBe(false);
      expect(perms.canMarkSepActivated).toBe(true);
    });
  });

  describe('generatePdf', () => {
    it('writes PDF to uploads dir and updates pdfPath when writable', async () => {
      const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sim-pdf-ok-'));
      try {
        const year = String(mockRecord.createdAt.getFullYear());
        const localModule = await Test.createTestingModule({
          providers: [
            InstallationRecordsService,
            { provide: PrismaService, useValue: prismaMock },
            { provide: RecordNumberGenerator, useValue: { generate: jest.fn() } },
            { provide: PdfGeneratorService, useValue: { generatePdf: jest.fn().mockResolvedValue(Buffer.from('pdf-bytes')) } },
            { provide: ActivityLogService, useValue: { log: jest.fn() } },
            { provide: MailService, useValue: { sendRecordWithPdf: jest.fn() } },
            { provide: MeterTypeFieldsService, useValue: { validateDynamicValues: jest.fn(), findAllByDefinition: jest.fn().mockResolvedValue([]) } },
            { provide: ConfigService, useValue: { get: jest.fn((_k: string) => tempRoot) } },
          ],
        }).compile();
        const localService = localModule.get<InstallationRecordsService>(InstallationRecordsService);
        prismaMock.installationRecord.findFirst.mockResolvedValue({
          ...mockRecord,
          kind: InstallationRecordKind.NEW_CONNECTION,
        });
        prismaMock.installationRecord.update.mockResolvedValue({ ...mockRecord, pdfPath: `installation-records/${year}/SN-001/zapisnik/REC-001.pdf` });

        const buf = await localService.generatePdf('rec-1');

        expect(buf.toString()).toBe('pdf-bytes');
        const expectedFile = path.join(tempRoot, 'installation-records', year, 'SN-001', 'zapisnik', 'REC-001.pdf');
        expect(fs.existsSync(expectedFile)).toBe(true);
        expect(prismaMock.installationRecord.update).toHaveBeenCalledWith({
          where: { id: 'rec-1' },
          data: { pdfPath: `installation-records/${year}/SN-001/zapisnik/REC-001.pdf` },
        });
      } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
      }
    });

    it('logs error and still returns PDF buffer when disk write fails with EACCES', async () => {
      const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sim-pdf-eacces-'));
      const year = String(mockRecord.createdAt.getFullYear());
      const zapisnikDir = path.join(tempRoot, 'installation-records', year, 'SN-001', 'zapisnik');
      const existingPdf = path.join(zapisnikDir, 'REC-001.pdf');
      fs.mkdirSync(zapisnikDir, { recursive: true });
      fs.writeFileSync(existingPdf, 'stale');
      fs.chmodSync(existingPdf, 0o444);
      fs.chmodSync(zapisnikDir, 0o555);

      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      try {
        const localModule = await Test.createTestingModule({
          providers: [
            InstallationRecordsService,
            { provide: PrismaService, useValue: prismaMock },
            { provide: RecordNumberGenerator, useValue: { generate: jest.fn() } },
            { provide: PdfGeneratorService, useValue: { generatePdf: jest.fn().mockResolvedValue(Buffer.from('fresh-pdf')) } },
            { provide: ActivityLogService, useValue: { log: jest.fn() } },
            { provide: MailService, useValue: { sendRecordWithPdf: jest.fn() } },
            { provide: MeterTypeFieldsService, useValue: { validateDynamicValues: jest.fn(), findAllByDefinition: jest.fn().mockResolvedValue([]) } },
            { provide: ConfigService, useValue: { get: jest.fn((_k: string) => tempRoot) } },
          ],
        }).compile();
        const localService = localModule.get<InstallationRecordsService>(InstallationRecordsService);
        prismaMock.installationRecord.findFirst.mockResolvedValue({
          ...mockRecord,
          kind: InstallationRecordKind.NEW_CONNECTION,
        });

        const buf = await localService.generatePdf('rec-1');

        expect(buf.toString()).toBe('fresh-pdf');
        expect(prismaMock.installationRecord.update).not.toHaveBeenCalled();
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('chown -R 1000:1000'));
      } finally {
        errorSpy.mockRestore();
        fs.chmodSync(zapisnikDir, 0o755);
        fs.chmodSync(existingPdf, 0o644);
        fs.rmSync(tempRoot, { recursive: true, force: true });
      }
    });

    it('deduplicates concurrent generatePdf calls for the same record id', async () => {
      let resolvePdf!: (buf: Buffer) => void;
      const pdfPromise = new Promise<Buffer>((res) => {
        resolvePdf = res;
      });
      const generatePdfMock = jest.fn().mockReturnValue(pdfPromise);
      const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sim-pdf-dedup-'));
      try {
        const localModule = await Test.createTestingModule({
          providers: [
            InstallationRecordsService,
            { provide: PrismaService, useValue: prismaMock },
            { provide: RecordNumberGenerator, useValue: { generate: jest.fn() } },
            { provide: PdfGeneratorService, useValue: { generatePdf: generatePdfMock } },
            { provide: ActivityLogService, useValue: { log: jest.fn() } },
            { provide: MailService, useValue: { sendRecordWithPdf: jest.fn() } },
            { provide: MeterTypeFieldsService, useValue: { validateDynamicValues: jest.fn(), findAllByDefinition: jest.fn().mockResolvedValue([]) } },
            { provide: ConfigService, useValue: { get: jest.fn((_k: string) => tempRoot) } },
          ],
        }).compile();
        const localService = localModule.get<InstallationRecordsService>(InstallationRecordsService);
        prismaMock.installationRecord.findFirst.mockResolvedValue({
          ...mockRecord,
          kind: InstallationRecordKind.NEW_CONNECTION,
        });
        prismaMock.installationRecord.update.mockResolvedValue(mockRecord);

        const p1 = localService.generatePdf('rec-1');
        const p2 = localService.generatePdf('rec-1');
        await new Promise((r) => setTimeout(r, 20));
        resolvePdf(Buffer.from('shared-pdf'));

        const [b1, b2] = await Promise.all([p1, p2]);
        expect(b1.toString()).toBe('shared-pdf');
        expect(b2.toString()).toBe('shared-pdf');
        expect(generatePdfMock).toHaveBeenCalledTimes(1);
      } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
      }
    });
  });

  describe('Run 4 hardening', () => {
    it('rejects NEW_CONNECTION on existing meter that already has a different SIM card', async () => {
      prismaMock.installationRecord.findUnique.mockResolvedValue(null);
      prismaMock.simCard.findFirst.mockResolvedValue({
        id: 'sim-new',
        status: 'AVAILABLE',
        assignedToId: null,
      });
      prismaMock.meter.findFirst.mockResolvedValue({
        id: 'meter-existing',
        status: 'ACTIVE',
        simCardId: 'sim-old',
      });

      await expect(
        service.create({
          simCardId: 'sim-new',
          installedById: 'user-1',
          kind: InstallationRecordKind.NEW_CONNECTION,
          meterId: 'meter-existing',
        }),
      ).rejects.toThrow('Odabrano brojilo već ima ugrađenu SIM karticu');
    });

    it('rejects USER create with branchId outside own/moderated branches', async () => {
      prismaMock.installationRecord.findUnique.mockResolvedValue(null);
      prismaMock.simCard.findFirst.mockResolvedValue({
        id: 'sim-1',
        status: 'AVAILABLE',
        assignedToId: null,
      });
      prismaMock.meterTypeDefinition.findUnique.mockResolvedValue({ id: 'type-1', name: 'Type' });
      prismaMock.meter.findUnique.mockResolvedValue(null);

      await expect(
        service.create(
          {
            simCardId: 'sim-1',
            installedById: 'user-1',
            kind: InstallationRecordKind.NEW_CONNECTION,
            meterTypeDefinitionId: 'type-1',
            serialNumber: 'SN-NEW',
            year: 2025,
            calibrationYear: 2025,
            branchId: 'branch-other',
          },
          {
            userId: 'user-1',
            role: UserRole.USER,
            branchId: 'branch-1',
            branchModeratorBranchIds: [],
          },
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects path traversal or unexpected prefix in photos on create and update', async () => {
      prismaMock.installationRecord.findUnique.mockResolvedValue(null);

      await expect(
        service.create({
          simCardId: 'sim-1',
          installedById: 'user-1',
          photos: ['../secrets.txt'],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      prismaMock.installationRecord.findFirst.mockResolvedValue(mockRecord);
      await expect(
        service.update('rec-1', { photos: ['/etc/passwd'] }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('blocks update transition to SEP_ACTIVATED', async () => {
      prismaMock.installationRecord.findFirst.mockResolvedValue({
        ...mockRecord,
        status: RecordStatus.SENT,
      });

      await expect(
        service.update('rec-1', { status: RecordStatus.SEP_ACTIVATED }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('includes moderator own records in findAllForUser', async () => {
      prismaMock.branchModerator.findMany.mockResolvedValue([{ branchId: 'branch-1' }]);

      await service.findAllForUser('user-1', { page: 1, limit: 20 } as never);

      expect(prismaMock.installationRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              {
                OR: [
                  { meter: { branchId: { in: ['branch-1'] } } },
                  { installedById: 'user-1' },
                ],
              },
            ]),
          }),
        }),
      );
    });

    it('applies branchId and search filters in findAll', async () => {
      await service.findAll(
        { page: 1, limit: 20, branchId: 'branch-1', search: '8938' } as never,
        { role: UserRole.SYSTEM_ADMIN, distributionId: null, branchId: null },
      );

      expect(prismaMock.installationRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              { meter: { branchId: 'branch-1' } },
              {
                OR: [
                  { recordNumber: { contains: '8938', mode: 'insensitive' } },
                  { meter: { serialNumber: { contains: '8938', mode: 'insensitive' } } },
                  { meter: { simCard: { iccid: { contains: '8938', mode: 'insensitive' } } } },
                ],
              },
            ]),
          }),
        }),
      );
    });

    it('unlinks installTask and removes PDF file on remove', async () => {
      const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sim-rec-rm-'));
      try {
        const relPdf = 'installation-records/2026/SN-001/zapisnik/REC-001.pdf';
        const fullPdf = path.join(tempRoot, relPdf);
        fs.mkdirSync(path.dirname(fullPdf), { recursive: true });
        fs.writeFileSync(fullPdf, 'pdf');

        const localModule = await Test.createTestingModule({
          providers: [
            InstallationRecordsService,
            { provide: PrismaService, useValue: prismaMock },
            { provide: RecordNumberGenerator, useValue: { generate: jest.fn() } },
            { provide: PdfGeneratorService, useValue: { generatePdf: jest.fn() } },
            { provide: ActivityLogService, useValue: { log: jest.fn() } },
            { provide: MailService, useValue: { sendRecordWithPdf: jest.fn() } },
            { provide: MeterTypeFieldsService, useValue: { validateDynamicValues: jest.fn(), findAllByDefinition: jest.fn().mockResolvedValue([]) } },
            { provide: ConfigService, useValue: { get: jest.fn((_k: string) => tempRoot) } },
          ],
        }).compile();
        const localService = localModule.get<InstallationRecordsService>(InstallationRecordsService);
        prismaMock.installationRecord.delete.mockResolvedValue({
          ...mockRecord,
          pdfPath: relPdf,
        });

        await localService.remove('rec-1', { userId: 'admin-1' });

        expect(prismaMock.installTask.updateMany).toHaveBeenCalledWith({
          where: { installationRecordId: 'rec-1' },
          data: { installationRecordId: null },
        });
        expect(fs.existsSync(fullPdf)).toBe(false);
      } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
      }
    });
  });
});
