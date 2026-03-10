import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

export type RegisterPushTokenInput = {
  userId: string;
  token: string;
  platform?: string;
  deviceId?: string;
};

@Injectable()
export class PushTokensService {
  constructor(private readonly prisma: PrismaService) {}

  async register(input: RegisterPushTokenInput) {
    const existing = await this.prisma.pushToken.findUnique({
      where: { token: input.token },
    });

    if (existing) {
      return this.prisma.pushToken.update({
        where: { id: existing.id },
        data: {
          userId: input.userId,
          platform: input.platform ?? existing.platform,
          deviceId: input.deviceId ?? existing.deviceId,
          isValid: true,
          lastUsedAt: new Date(),
        },
      });
    }

    return this.prisma.pushToken.create({
      data: {
        userId: input.userId,
        token: input.token,
        platform: input.platform,
        deviceId: input.deviceId,
        isValid: true,
        lastUsedAt: new Date(),
      },
    });
  }

  async invalidateToken(token: string, userId: string) {
    const existing = await this.prisma.pushToken.findUnique({
      where: { token },
    });
    if (!existing || existing.userId !== userId) {
      return;
    }
    await this.prisma.pushToken.update({
      where: { id: existing.id },
      data: { isValid: false },
    });
  }
}

