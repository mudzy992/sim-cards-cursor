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

  async getBoolean(key: string, defaultValue: boolean): Promise<boolean> {
    const setting = await this.prisma.appSetting.findUnique({
      where: { key },
    });
    if (!setting || setting.value == null) {
      return defaultValue;
    }
    const raw = String(setting.value).toLowerCase().trim();
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return defaultValue;
  }

  async isMobilePushEnabled(): Promise<boolean> {
    return this.getBoolean('mobile.push.enabled', true);
  }

  async isPushCampaignsEnabled(): Promise<boolean> {
    const mobilePush = await this.isMobilePushEnabled();
    const pushEnabled = await this.getBoolean('notifications.mobile.pushEnabled', true);
    return mobilePush && pushEnabled;
  }

  async getFeatures(): Promise<{
    pushCampaignsEnabled: boolean;
    mobilePushEnabled: boolean;
    emailEnabled: boolean;
    smtpProvider: string | null;
    smtpConfigured: boolean;
    missingKeys: string[];
  }> {
    const mobilePushEnabled = await this.isMobilePushEnabled();
    const pushCampaignsEnabled = await this.isPushCampaignsEnabled();
    const emailEnabled = await this.getBoolean('email.enabled', true);
    const smtpProvider = await this.prisma.appSetting
      .findUnique({ where: { key: 'smtp.provider' }, select: { value: true } })
      .then((r) => r?.value ?? null);
    const smtpUser = await this.prisma.appSetting
      .findUnique({ where: { key: 'smtp.user' }, select: { value: true } })
      .then((r) => r?.value ?? null);
    const smtpPass = await this.prisma.appSetting
      .findUnique({ where: { key: 'smtp.pass' }, select: { value: true } })
      .then((r) => r?.value ?? null);

    const provider = (smtpProvider ?? 'custom').trim().toLowerCase();
    const smtpConfigured =
      !emailEnabled || provider === 'disabled'
        ? true
        : Boolean(smtpUser?.trim()) && Boolean(smtpPass?.trim());

    const requiredKeys = [
      'email.enabled',
      'smtp.provider',
      'mobile.push.enabled',
      'notifications.mobile.pushEnabled',
    ];
    const existing = await this.prisma.appSetting.findMany({
      where: { key: { in: requiredKeys } },
      select: { key: true },
    });
    const existingSet = new Set(existing.map((e) => e.key));
    const missingKeys = requiredKeys.filter((k) => !existingSet.has(k));

    if (emailEnabled && provider !== 'disabled' && (!smtpUser?.trim() || !smtpPass?.trim())) {
      missingKeys.push('smtp.user', 'smtp.pass');
    }

    return {
      pushCampaignsEnabled,
      mobilePushEnabled,
      emailEnabled,
      smtpProvider,
      smtpConfigured,
      missingKeys: [...new Set(missingKeys)],
    };
  }

  async setMobilePushEnabled(
    enabled: boolean,
    ctx?: SettingChangeContext,
  ): Promise<AppSetting> {
    return this.upsert(
      'mobile.push.enabled',
      {
        value: enabled ? 'true' : 'false',
        description: 'Globalni toggle za mobilne push notifikacije (offline/online okruženje).',
      },
      ctx,
    );
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
