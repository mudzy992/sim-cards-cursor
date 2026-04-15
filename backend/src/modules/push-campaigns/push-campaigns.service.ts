import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Prisma,
  PushCampaignAudienceType,
  PushCampaignStatus,
  PushDeliveryStatus,
  UserRole,
} from '@prisma/client';
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationsService } from 'src/modules/notifications/notifications.service';
import { scopeWhere, ScopeContext } from 'src/common/utils/scope-filter.util';

export type CreateCampaignInput = {
  actor: ScopeContext & { id: string };
  title: string;
  message: string;
  deepLink?: string;
  audienceType: PushCampaignAudienceType;
  filters?: Record<string, unknown>;
  targetUserId?: string;
};

@Injectable()
export class PushCampaignsService {
  private readonly expo = new Expo();

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  async createDraft(input: CreateCampaignInput) {
    this.validateCreate(input);

    const scopeDistributionId =
      input.actor.role === UserRole.DIST_ADMIN ? input.actor.distributionId : null;
    const scopeBranchId = null;

    if (input.actor.role === UserRole.DIST_ADMIN && !scopeDistributionId) {
      throw new ForbiddenException('Distribution admin scope is missing');
    }

    const campaign = await this.prisma.pushCampaign.create({
      data: {
        createdById: input.actor.id,
        scopeDistributionId: scopeDistributionId ?? undefined,
        scopeBranchId: scopeBranchId ?? undefined,
        title: input.title,
        message: input.message,
        deepLink: input.deepLink,
        audienceType: input.audienceType,
        filters: (input.filters as Prisma.InputJsonValue | undefined) ?? undefined,
        targetUserId: input.targetUserId,
        status: PushCampaignStatus.DRAFT,
      },
    });

    await this.prisma.activityLog.create({
      data: {
        userId: input.actor.id,
        action: 'CREATE',
        entity: 'push_campaign',
        entityId: campaign.id,
        details: { audienceType: campaign.audienceType },
      },
    });

    return campaign;
  }

  async sendCampaign(id: string, actor: ScopeContext & { id: string }) {
    const campaign = await this.prisma.pushCampaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    await this.assertCampaignScope(campaign, actor);

    if (campaign.status !== PushCampaignStatus.DRAFT) {
      throw new BadRequestException('Campaign already sent');
    }

    await this.prisma.pushCampaign.update({
      where: { id },
      data: { status: PushCampaignStatus.SENDING },
    });

    const recipients = await this.resolveRecipientUsers(campaign, actor);
    if (recipients.length === 0) {
      await this.prisma.pushCampaign.update({
        where: { id },
        data: { status: PushCampaignStatus.FAILED, sentAt: new Date() },
      });
      throw new BadRequestException('No recipients for this campaign');
    }

    const tokens = await this.prisma.pushToken.findMany({
      where: {
        isValid: true,
        userId: { in: recipients.map((u) => u.id) },
      },
      select: { id: true, token: true, userId: true },
    });

    // Create in-app notifications regardless of push delivery result.
    await Promise.all(
      recipients.map((u) =>
        this.notifications.create({
          userId: u.id,
          title: campaign.title,
          message: campaign.message,
          type: 'PUSH_CAMPAIGN',
          link: campaign.deepLink ?? '/notifications',
        }),
      ),
    );

    // Create delivery rows per token
    if (tokens.length) {
      await this.prisma.pushDelivery.createMany({
        data: tokens.map((t) => ({
          campaignId: campaign.id,
          userId: t.userId,
          pushTokenId: t.id,
          status: PushDeliveryStatus.QUEUED,
        })),
        skipDuplicates: true,
      });
    }

    const messages: Array<{ pushTokenId: string; userId: string; msg: ExpoPushMessage }> = [];
    for (const t of tokens) {
      if (!Expo.isExpoPushToken(t.token)) {
        await this.prisma.pushToken.update({ where: { id: t.id }, data: { isValid: false } });
        await this.prisma.pushDelivery.updateMany({
          where: { campaignId: campaign.id, pushTokenId: t.id },
          data: { status: PushDeliveryStatus.INVALID_TOKEN, errorCode: 'INVALID_EXPO_TOKEN' },
        });
        continue;
      }
      messages.push({
        pushTokenId: t.id,
        userId: t.userId,
        msg: {
          to: t.token,
          title: campaign.title,
          body: campaign.message,
          data: campaign.deepLink ? { deepLink: campaign.deepLink } : undefined,
          sound: 'default',
        },
      });
    }

    const chunks = this.expo.chunkPushNotifications(messages.map((m) => m.msg));
    let ticketIndex = 0;
    const tickets: ExpoPushTicket[] = [];

    for (const chunk of chunks) {
      const part = await this.expo.sendPushNotificationsAsync(chunk);
      tickets.push(...part);
    }

    // Map tickets back to messages by index order
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      const message = messages[ticketIndex++];
      if (!message) break;

      if (ticket.status === 'ok') {
        await this.prisma.pushDelivery.updateMany({
          where: { campaignId: campaign.id, pushTokenId: message.pushTokenId },
          data: { status: PushDeliveryStatus.SENT, expoTicketId: ticket.id ?? null },
        });
      } else {
        const errorCode = ticket.details?.error ?? 'EXPO_PUSH_ERROR';
        await this.prisma.pushDelivery.updateMany({
          where: { campaignId: campaign.id, pushTokenId: message.pushTokenId },
          data: {
            status: PushDeliveryStatus.FAILED,
            errorCode,
            errorMessage: ticket.message ?? null,
          },
        });
        if (errorCode === 'DeviceNotRegistered') {
          await this.prisma.pushToken.update({
            where: { id: message.pushTokenId },
            data: { isValid: false },
          });
        }
      }
    }

    const stats = await this.getStats(campaign.id, actor);
    const finalStatus =
      stats.failed > 0 && stats.sent > 0
        ? PushCampaignStatus.PARTIAL
        : stats.failed > 0 && stats.sent === 0
          ? PushCampaignStatus.FAILED
          : PushCampaignStatus.SENT;

    await this.prisma.pushCampaign.update({
      where: { id: campaign.id },
      data: { status: finalStatus, sentAt: new Date() },
    });

    await this.prisma.activityLog.create({
      data: {
        userId: actor.id,
        action: 'SEND',
        entity: 'push_campaign',
        entityId: campaign.id,
        details: { recipients: recipients.length, tokens: tokens.length },
      },
    });

    return { id: campaign.id, status: finalStatus, ...stats };
  }

  async list(dto: { status?: PushCampaignStatus; page?: number; limit?: number }, actor: ScopeContext & { id: string }) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;

    const where: Prisma.PushCampaignWhereInput = {
      ...(dto.status ? { status: dto.status } : {}),
      ...(actor.role === UserRole.DIST_ADMIN && actor.distributionId
        ? { scopeDistributionId: actor.distributionId }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.pushCampaign.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.pushCampaign.count({ where }),
    ]);

    return { items, page, limit, total, totalPages: Math.ceil(total / limit) || 1 };
  }

  async getOne(id: string, actor: ScopeContext & { id: string }) {
    const campaign = await this.prisma.pushCampaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    await this.assertCampaignScope(campaign, actor);
    return campaign;
  }

  async getStats(id: string, actor: ScopeContext & { id: string }) {
    const campaign = await this.prisma.pushCampaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    await this.assertCampaignScope(campaign, actor);

    const [queued, sent, delivered, failed, invalid] = await Promise.all([
      this.prisma.pushDelivery.count({ where: { campaignId: id, status: PushDeliveryStatus.QUEUED } }),
      this.prisma.pushDelivery.count({ where: { campaignId: id, status: PushDeliveryStatus.SENT } }),
      this.prisma.pushDelivery.count({ where: { campaignId: id, status: PushDeliveryStatus.DELIVERED } }),
      this.prisma.pushDelivery.count({ where: { campaignId: id, status: PushDeliveryStatus.FAILED } }),
      this.prisma.pushDelivery.count({ where: { campaignId: id, status: PushDeliveryStatus.INVALID_TOKEN } }),
    ]);

    // read = in-app notifications read count matching title+message+type is not reliable; for MVP, read stats omitted here.
    return {
      queued,
      sent,
      delivered,
      failed,
      invalid,
      total: queued + sent + delivered + failed + invalid,
    };
  }

  async listRecipients(id: string, actor: ScopeContext & { id: string }, params?: { page?: number; limit?: number }) {
    const campaign = await this.prisma.pushCampaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    await this.assertCampaignScope(campaign, actor);

    const page = params?.page ?? 1;
    const limit = params?.limit ?? 50;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.pushDelivery.findMany({
        where: { campaignId: id },
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true, role: true, distributionId: true, branchId: true } },
          pushToken: { select: { id: true, platform: true, deviceId: true, token: true, isValid: true } },
        },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.pushDelivery.count({ where: { campaignId: id } }),
    ]);

    return { items, page, limit, total, totalPages: Math.ceil(total / limit) || 1 };
  }

  /**
   * Poll receipts for recently sent deliveries.
   * Keeps it simple: every N seconds fetch receipts for SENT deliveries with ticketIds.
   */
  async pollReceiptsOnce() {
    const enabled = this.config.get<string>('PUSH_RECEIPTS_POLL_ENABLED', 'true') === 'true';
    if (!enabled) return;

    const max = Number(this.config.get<string>('PUSH_RECEIPTS_POLL_MAX') ?? '200');
    const deliveries = await this.prisma.pushDelivery.findMany({
      where: {
        status: PushDeliveryStatus.SENT,
        expoTicketId: { not: null },
      },
      take: max,
      orderBy: { createdAt: 'desc' },
      select: { id: true, expoTicketId: true, pushTokenId: true },
    });

    const receiptIds = deliveries.map((d) => d.expoTicketId!).filter(Boolean);
    if (!receiptIds.length) return;

    const chunks = this.expo.chunkPushNotificationReceiptIds(receiptIds);
    const receiptMap: Record<string, unknown> = {};

    for (const chunk of chunks) {
      const receipts = await this.expo.getPushNotificationReceiptsAsync(chunk);
      Object.assign(receiptMap, receipts);
    }

    const now = new Date();
    for (const d of deliveries) {
      const receipt = receiptMap[d.expoTicketId!] as { status?: string; message?: string; details?: { error?: string } } | undefined;
      if (!receipt) continue;

      if (receipt.status === 'ok') {
        await this.prisma.pushDelivery.update({
          where: { id: d.id },
          data: { status: PushDeliveryStatus.DELIVERED, deliveredAt: now, receiptCheckedAt: now },
        });
      } else if (receipt.status === 'error') {
        const errorCode = receipt.details?.error ?? 'EXPO_RECEIPT_ERROR';
        await this.prisma.pushDelivery.update({
          where: { id: d.id },
          data: {
            status: PushDeliveryStatus.FAILED,
            errorCode,
            errorMessage: receipt.message ?? null,
            receiptCheckedAt: now,
          },
        });
        if (errorCode === 'DeviceNotRegistered') {
          await this.prisma.pushToken.update({
            where: { id: d.pushTokenId },
            data: { isValid: false },
          });
        }
      }
    }
  }

  private validateCreate(input: CreateCampaignInput) {
    if (input.audienceType === PushCampaignAudienceType.USER && !input.targetUserId) {
      throw new BadRequestException('targetUserId is required for USER audience');
    }
    if (input.audienceType === PushCampaignAudienceType.FILTER && !input.filters) {
      throw new BadRequestException('filters is required for FILTER audience');
    }
  }

  private async resolveRecipientUsers(
    campaign: {
      audienceType: PushCampaignAudienceType;
      filters: Prisma.JsonValue | null;
      targetUserId: string | null;
    },
    actor: ScopeContext,
  ) {
    if (campaign.audienceType === PushCampaignAudienceType.USER) {
      if (!campaign.targetUserId) return [];
      const scopeClause = scopeWhere<Prisma.UserWhereInput>(actor, { userScope: true });
      const user = await this.prisma.user.findFirst({
        where: { id: campaign.targetUserId, ...(scopeClause ? { AND: [scopeClause] } : {}) },
        select: { id: true },
      });
      return user ? [user] : [];
    }

    if (campaign.audienceType === PushCampaignAudienceType.ALL) {
      const scopeClause = scopeWhere<Prisma.UserWhereInput>(actor, { userScope: true });
      return this.prisma.user.findMany({
        where: { ...(scopeClause ? { AND: [scopeClause] } : {}) },
        select: { id: true },
      });
    }

    // FILTER: podržava role filter i/ili eksplicitnu listu userIds.
    const filters = (campaign.filters ?? {}) as Record<string, unknown>;
    const role = filters.role as UserRole | undefined;
    const userIds = Array.isArray(filters.userIds)
      ? (filters.userIds as string[]).filter((id) => typeof id === 'string')
      : undefined;

    const scopeClause = scopeWhere<Prisma.UserWhereInput>(actor, { userScope: true });
    return this.prisma.user.findMany({
      where: {
        ...(userIds && userIds.length ? { id: { in: userIds } } : {}),
        ...(role ? { role } : {}),
        ...(scopeClause ? { AND: [scopeClause] } : {}),
      },
      select: { id: true },
    });
  }

  private async assertCampaignScope(
    campaign: { scopeDistributionId: string | null; scopeBranchId: string | null },
    actor: ScopeContext,
  ) {
    if (actor.role === UserRole.SYSTEM_ADMIN) return;
    if (actor.role === UserRole.DIST_ADMIN) {
      if (!actor.distributionId) throw new ForbiddenException('Missing distribution admin scope');
      if (campaign.scopeDistributionId && campaign.scopeDistributionId !== actor.distributionId) {
        throw new ForbiddenException('Out of scope');
      }
      return;
    }
    throw new ForbiddenException('Insufficient permissions');
  }
}

