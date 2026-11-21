import { PrismaService } from 'src/prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';

describe('NotificationsService — Run 6 hardening', () => {
  function createMocks() {
    const prisma = {
      notification: {
        create: jest.fn(),
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const gateway = {
      sendToUser: jest.fn(),
    };
    const settings = {
      getNotificationChannelSettings: jest.fn().mockResolvedValue({
        inAppEnabled: true,
        pushEnabled: true,
        emailEnabled: true,
      }),
    };
    const service = new NotificationsService(
      prisma as unknown as PrismaService,
      gateway as unknown as NotificationsGateway,
      settings as unknown as SettingsService,
    );
    return { service, prisma, gateway, settings };
  }

  it('creates bulk notifications with a single settings check and emits via socket gateway', async () => {
    const { service, prisma, gateway, settings } = createMocks();

    const count = await service.createBulk([
      { userId: 'u-1', title: 'T1', message: 'M1', type: 'PUSH_CAMPAIGN' },
      { userId: 'u-2', title: 'T1', message: 'M1', type: 'PUSH_CAMPAIGN' },
    ]);

    expect(count).toBe(2);
    expect(settings.getNotificationChannelSettings).toHaveBeenCalledTimes(1);
    expect(prisma.notification.createMany).toHaveBeenCalledTimes(1);
    expect(gateway.sendToUser).toHaveBeenCalledTimes(2);
  });

  it('clamps findByUser limit to 100 max', async () => {
    const { service, prisma } = createMocks();

    await service.findByUser('u-1', { limit: 9999 });

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });
});
