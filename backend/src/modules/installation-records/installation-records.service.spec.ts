import { BadRequestException, ForbiddenException } from '@nestjs/common';
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

describe('InstallationRecordsService', () => {
  let service: InstallationRecordsService;
  let prismaMock: Record<string, any>;

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn((args) => {
        if (Array.isArray(args)) return Promise.resolve(args);
        return args(prismaMock);
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
      meter: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      meterTypeDefinition: { findUnique: jest.fn() },
      simCard: { findUnique: jest.fn(), update: jest.fn() },
      simEvent: { create: jest.fn() },
      branchModerator: { findUnique: jest.fn(), findMany: jest.fn() },
      branchEmailRecipient: { findMany: jest.fn() },
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
      prismaMock.meter.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ simCardId: null });
      prismaMock.meter.create.mockResolvedValue({ id: 'meter-new' });
      prismaMock.simCard.findUnique.mockResolvedValue({ id: 'sim-1' });
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
});
