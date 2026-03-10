import { Injectable, NotFoundException } from '@nestjs/common';
import { AppSetting } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { UserTourStateDto } from './dto/update-my-settings.dto';

type SettingChangeContext = {
  userId?: string;
  ipAddress?: string;
};

export type UserTourState = {
  web?: {
    systemAdmin?: {
      completedAt?: string | null;
    };
    moderator?: {
      completedAt?: string | null;
    };
    lastVersionSeen?: string | null;
  };
  mobile?: {
    completedAt?: string | null;
  };
};

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  async findAll(): Promise<AppSetting[]> {
    return this.prisma.appSetting.findMany({
      orderBy: { key: 'asc' },
    });
  }

  async findByKey(key: string): Promise<AppSetting> {
    const setting = await this.prisma.appSetting.findUnique({
      where: { key },
    });
    if (!setting) {
      throw new NotFoundException(`Setting with key "${key}" not found`);
    }
    return setting;
  }

  async getValue(key: string): Promise<string> {
    const setting = await this.findByKey(key);
    return setting.value;
  }

  private getUserTourKey(userId: string): string {
    return `user:tour-state:${userId}`;
  }

  private parseUserTourState(value: string | null | undefined): UserTourState {
    if (!value) {
      return {};
    }
    try {
      const parsed = JSON.parse(value) as UserTourState;
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
      // eslint-disable-next-line no-empty
    } catch {}
    return {};
  }

  private mergeTourState(
    current: UserTourState,
    patch: UserTourStateDto,
  ): UserTourState {
    return {
      ...current,
      ...(patch.tour ? { ...current } : current),
      web: patch.web
        ? {
            ...current.web,
            ...(patch.web.systemAdmin && {
              systemAdmin: {
                ...current.web?.systemAdmin,
                ...patch.web.systemAdmin,
              },
            }),
            ...(patch.web.moderator && {
              moderator: {
                ...current.web?.moderator,
                ...patch.web.moderator,
              },
            }),
            ...(Object.prototype.hasOwnProperty.call(
              patch.web,
              'lastVersionSeen',
            ) && {
              lastVersionSeen: patch.web.lastVersionSeen,
            }),
          }
        : current.web,
      mobile: patch.mobile
        ? {
          ...current.mobile,
          ...patch.mobile,
        }
        : current.mobile,
    };
  }

  async getUserTourState(userId: string): Promise<UserTourState> {
    const key = this.getUserTourKey(userId);
    const setting = await this.prisma.appSetting.findUnique({
      where: { key },
    });
    return this.parseUserTourState(setting?.value);
  }

  async updateUserTourState(
    userId: string,
    dto: UserTourStateDto,
    ctx?: SettingChangeContext,
  ): Promise<UserTourState> {
    const key = this.getUserTourKey(userId);
    const existing = await this.prisma.appSetting.findUnique({
      where: { key },
    });

    const currentState = this.parseUserTourState(existing?.value);
    const nextState = this.mergeTourState(currentState, dto);

    const value = JSON.stringify(nextState);

    const setting = await this.prisma.appSetting.upsert({
      where: { key },
      create: {
        key,
        value,
        description: 'Per-user tour state (web/mobile)',
      },
      update: {
        value,
      },
    });

    await this.activityLogService.log({
      userId: ctx?.userId,
      action: existing ? 'UPDATE_USER_TOUR_STATE' : 'CREATE_USER_TOUR_STATE',
      entity: 'user_tour_state',
      entityId: setting.id,
      details: {
        key,
        oldValue: existing?.value ?? null,
        newValue: setting.value,
      },
      ipAddress: ctx?.ipAddress,
    });

    return nextState;
  }

  async upsert(
    key: string,
    dto: UpdateSettingDto,
    ctx?: SettingChangeContext,
  ): Promise<AppSetting> {
    const existing = await this.prisma.appSetting.findUnique({
      where: { key },
    });

    const setting = await this.prisma.appSetting.upsert({
      where: { key },
      create: {
        key,
        value: dto.value,
        description: dto.description,
      },
      update: {
        value: dto.value,
        ...(dto.description !== undefined && { description: dto.description }),
      },
    });

    await this.activityLogService.log({
      userId: ctx?.userId,
      action: existing ? 'UPDATE_SETTING' : 'CREATE_SETTING',
      entity: 'app_setting',
      entityId: setting.id,
      details: {
        key,
        oldValue: existing?.value ?? null,
        newValue: setting.value,
        oldDescription: existing?.description ?? null,
        newDescription: setting.description ?? null,
      },
      ipAddress: ctx?.ipAddress,
    });

    return setting;
  }

  async update(key: string, dto: UpdateSettingDto): Promise<AppSetting> {
    await this.findByKey(key);
    return this.prisma.appSetting.update({
      where: { key },
      data: {
        value: dto.value,
        ...(dto.description !== undefined && { description: dto.description }),
      },
    });
  }
}
