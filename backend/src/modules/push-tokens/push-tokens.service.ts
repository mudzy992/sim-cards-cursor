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
    const token = input.token.trim();
    const existing = await this.prisma.pushToken.findUnique({
      where: { token },
    });

    if (existing) {
      return this.prisma.pushToken.update({
        where: { id: existing.id },
        data: {
          userId: input.userId,
          platform: input.platform?.trim() ?? existing.platform,
          deviceId: input.deviceId?.trim() ?? existing.deviceId,
          isValid: true,
          lastUsedAt: new Date(),
        },
      });
    }

    return this.prisma.pushToken.create({
      data: {
        userId: input.userId,
        token,
        platform: input.platform?.trim(),
        deviceId: input.deviceId?.trim(),
        isValid: true,
        lastUsedAt: new Date(),
      },
    });
  }

  async invalidateToken(token: string, userId: string) {
    const normalized = token.trim();
    const existing = await this.prisma.pushToken.findUnique({
      where: { token: normalized },
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

