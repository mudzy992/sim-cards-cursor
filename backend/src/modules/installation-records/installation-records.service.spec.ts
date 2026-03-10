import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RecordStatus, UserRole } from '@prisma/client';
import { RecordNumberGenerator } from 'src/common/utils/record-number.generator';
import { PdfGeneratorService } from 'src/common/utils/pdf-generator.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RecipientsService } from '../recipients/recipients.service';
import { InstallationRecordsService } from './installation-records.service';

describe('InstallationRecordsService RBAC', () => {
  let service: InstallationRecordsService;
  let prisma: {
    meter: { findUnique: jest.Mock };
    installationRecord: { update: jest.Mock };
  };
  let recipientsService: { isUserInApprovalGroupForBranch: jest.Mock };

  beforeEach(async () => {
    prisma = {
      meter: { findUnique: jest.fn() },
      installationRecord: { update: jest.fn() },
    };

    recipientsService = {
      isUserInApprovalGroupForBranch: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InstallationRecordsService,
        { provide: PrismaService, useValue: prisma },
        { provide: RecordNumberGenerator, useValue: {} },
        { provide: PdfGeneratorService, useValue: {} },
        { provide: ActivityLogService, useValue: { log: jest.fn() } },
        { provide: MailService, useValue: {} },
        { provide: RecipientsService, useValue: recipientsService },
        { provide: NotificationsService, useValue: { create: jest.fn() } },
      ],
    }).compile();

    service = module.get<InstallationRecordsService>(InstallationRecordsService);
  });

  it('allows USER to approve when user belongs to branch approval group', async () => {
    const record = {
      id: 'r1',
      meterId: 'm1',
      installedById: 'installer-1',
      recordNumber: 'ZR-001',
      status: RecordStatus.PENDING,
    };
    jest.spyOn(service, 'findOne').mockResolvedValue(record as never);
    prisma.meter.findUnique.mockResolvedValue({ branchId: 'b1' });
    recipientsService.isUserInApprovalGroupForBranch.mockResolvedValue(true);
    prisma.installationRecord.update.mockResolvedValue({
      ...record,
      status: RecordStatus.WAITING_SEP_ACTIVATION,
    });

    const result = await service.approve('r1', 'user-1', {
      role: UserRole.USER,
      distributionId: 'd1',
      branchId: 'b1',
    });

    expect(result.status).toBe(RecordStatus.WAITING_SEP_ACTIVATION);
    expect(recipientsService.isUserInApprovalGroupForBranch).toHaveBeenCalledWith(
      'user-1',
      'b1',
    );
  });

  it('blocks USER approve when user is not in branch approval group', async () => {
    const record = {
      id: 'r1',
      meterId: 'm1',
      installedById: 'installer-1',
      recordNumber: 'ZR-001',
      status: RecordStatus.PENDING,
    };
    jest.spyOn(service, 'findOne').mockResolvedValue(record as never);
    prisma.meter.findUnique.mockResolvedValue({ branchId: 'b1' });
    recipientsService.isUserInApprovalGroupForBranch.mockResolvedValue(false);

    await expect(
      service.approve('r1', 'user-1', {
        role: UserRole.USER,
        distributionId: 'd1',
        branchId: 'b1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.installationRecord.update).not.toHaveBeenCalled();
  });

  it('blocks USER from approving own record even when in approval group', async () => {
    const record = {
      id: 'r1',
      meterId: 'm1',
      installedById: 'user-1',
      recordNumber: 'ZR-001',
      status: RecordStatus.PENDING,
    };
    jest.spyOn(service, 'findOne').mockResolvedValue(record as never);
    prisma.meter.findUnique.mockResolvedValue({ branchId: 'b1' });
    recipientsService.isUserInApprovalGroupForBranch.mockResolvedValue(true);

    await expect(
      service.approve('r1', 'user-1', {
        role: UserRole.USER,
        distributionId: 'd1',
        branchId: 'b1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.installationRecord.update).not.toHaveBeenCalled();
  });

  it('allows MODERATOR approve without approval-group membership check', async () => {
    const record = {
      id: 'r1',
      meterId: 'm1',
      installedById: 'installer-1',
      recordNumber: 'ZR-001',
      status: RecordStatus.PENDING,
    };
    jest.spyOn(service, 'findOne').mockResolvedValue(record as never);
    prisma.installationRecord.update.mockResolvedValue({
      ...record,
      status: RecordStatus.WAITING_SEP_ACTIVATION,
    });

    await service.approve('r1', 'mod-1', {
      role: UserRole.MODERATOR,
      distributionId: 'd1',
      branchId: null,
    });

    expect(recipientsService.isUserInApprovalGroupForBranch).not.toHaveBeenCalled();
  });

  it('blocks USER list access when user has no branch scope', async () => {
    await expect(
      service.findAll(
        { page: 1, limit: 20 } as never,
        { role: UserRole.USER, distributionId: null, branchId: null },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
