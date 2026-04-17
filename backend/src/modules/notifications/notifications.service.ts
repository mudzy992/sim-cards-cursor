import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Notification } from '@prisma/client';
import { NotificationsGateway } from './notifications.gateway';
import { SettingsService } from '../settings/settings.service';

export interface CreateNotificationDto {
  userId: string;
  title: string;
  message: string;
  type: string;
  link?: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
    private readonly settings: SettingsService,
  ) {}

  async create(dto: CreateNotificationDto): Promise<Notification | null> {
    const { inAppEnabled } = await this.settings.getNotificationChannelSettings();
    if (!inAppEnabled) {
      return null;
    }
    const notification = await this.prisma.notification.create({
      data: {
        userId: dto.userId,
        title: dto.title,
        message: dto.message,
        type: dto.type,
        link: dto.link,
      },
    });
    this.gateway.sendToUser(dto.userId, 'notification', notification);
    return notification;
  }

  async findByUser(
    userId: string,
    options?: { unreadOnly?: boolean; limit?: number },
  ): Promise<Notification[]> {
    const { unreadOnly = false, limit = 50 } = options ?? {};
    return this.prisma.notification.findMany({
      where: {
        userId,
        ...(unreadOnly && { isRead: false }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  async markAsRead(id: string, userId: string): Promise<Notification> {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string): Promise<{ count: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { count: result.count };
  }
}
