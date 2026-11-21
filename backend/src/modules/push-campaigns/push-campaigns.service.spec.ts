import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PushCampaignAudienceType,
  PushCampaignStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SettingsService } from '../settings/settings.service';
import { PushCampaignsService } from './push-campaigns.service';

describe('PushCampaignsService — Run 6 hardening', () => {
  function createMocks() {
    const prisma = {
      pushCampaign: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      pushToken: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
      pushDelivery: {
        createMany: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      activityLog: {
        create: jest.fn().mockResolvedValue({ id: 'log-1' }),
      },
      $transaction: jest.fn(async (args: unknown[]) => Promise.all(args)),
    };

    const notifications = {
      create: jest.fn().mockResolvedValue(null),
      createBulk: jest.fn().mockResolvedValue(1),
    };
    const config = { get: jest.fn((_k: string, def: string) => def) };
    const settings = {
      getNotificationChannelSettings: jest.fn().mockResolvedValue({
        inAppEnabled: true,
        pushEnabled: true,
        emailEnabled: true,
      }),
    };

    const service = new PushCampaignsService(
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationsService,
      config as unknown as ConfigService,
      settings as unknown as SettingsService,
    );

    return { service, prisma, notifications, settings };
  }

  const distAdmin = {
    id: 'da-1',
    role: UserRole.DIST_ADMIN,
    distributionId: 'dist-1',
    branchId: null,
  };

  it('blocks DIST_ADMIN from viewing or sending global SYSTEM_ADMIN campaigns (scopeDistributionId=null)', async () => {
    const { service, prisma } = createMocks();
    prisma.pushCampaign.findUnique.mockResolvedValue({
      id: 'camp-global',
      scopeDistributionId: null,
      scopeBranchId: null,
      status: PushCampaignStatus.DRAFT,
      audienceType: PushCampaignAudienceType.ALL,
      filters: null,
      targetUserId: null,
      title: 'Global',
      message: 'Msg',
      deepLink: null,
    });

    await expect(service.getOne('camp-global', distAdmin)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.getStats('camp-global', distAdmin)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.listRecipients('camp-global', distAdmin)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.sendCampaign('camp-global', distAdmin)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('fails closed on list() when DIST_ADMIN has no distributionId', async () => {
    const { service, prisma } = createMocks();
    const res = await service.list(
      { page: 1, limit: 20 },
      { id: 'da-empty', role: UserRole.DIST_ADMIN, distributionId: null, branchId: null },
    );
    expect(res.items).toEqual([]);
    expect(res.total).toBe(0);
    expect(prisma.pushCampaign.findMany).not.toHaveBeenCalled();
  });

  it('prevents concurrent double-send via atomic DRAFT->SENDING updateMany lock', async () => {
    const { service, prisma } = createMocks();
    prisma.pushCampaign.findUnique.mockResolvedValue({
      id: 'camp-1',
      scopeDistributionId: 'dist-1',
      scopeBranchId: null,
      status: PushCampaignStatus.DRAFT,
      audienceType: PushCampaignAudienceType.ALL,
      filters: null,
      targetUserId: null,
      title: 'Hi',
      message: 'Body',
      deepLink: null,
    });
    prisma.pushCampaign.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(service.sendCampaign('camp-1', distAdmin)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('resolves only ACTIVE users and sends notifications via createBulk', async () => {
    const { service, prisma, notifications } = createMocks();
    prisma.pushCampaign.findUnique.mockResolvedValue({
      id: 'camp-1',
      scopeDistributionId: 'dist-1',
      scopeBranchId: null,
      status: PushCampaignStatus.DRAFT,
      audienceType: PushCampaignAudienceType.ALL,
      filters: null,
      targetUserId: null,
      title: 'Notice',
      message: 'Body',
      deepLink: '/notifications',
    });
    prisma.user.findMany.mockResolvedValueOnce([{ id: 'u-1' }, { id: 'u-2' }]);

    await service.sendCampaign('camp-1', distAdmin);

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: UserStatus.ACTIVE }),
      }),
    );
    expect(notifications.createBulk).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ userId: 'u-1', title: 'Notice' }),
        expect.objectContaining({ userId: 'u-2', title: 'Notice' }),
      ]),
    );
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('rejects unsafe deepLink schemes on createDraft', async () => {
    const { service } = createMocks();
    await expect(
      service.createDraft({
        actor: distAdmin,
        title: 'Test',
        message: 'Body',
        deepLink: 'javascript:alert(1)',
        audienceType: PushCampaignAudienceType.ALL,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
