import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AppSetting } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { UserTourStateDto } from './dto/update-my-settings.dto';
import { SETTINGS_KEYS } from './settings-keys';

const USER_TOUR_KEY_PREFIX = 'user:tour-state:';
const MASKED_SECRET = '••••••••';

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

  private isSensitiveSettingKey(key: string): boolean {
    if (key === SETTINGS_KEYS.smtpPass) {
      return true;
    }
    return /(^|[._:])(pass|password|secret|token|apikey)($|[._:])/i.test(key);
  }

  private maskSecret(value: string | null | undefined): string {
    return value ? MASKED_SECRET : '';
  }

  private sanitizeSetting(setting: AppSetting): AppSetting {
    if (this.isSensitiveSettingKey(setting.key)) {
      return {
        ...setting,
        value: this.maskSecret(setting.value),
      };
    }
    return setting;
  }

  private assertPublicSettingKey(key: string): string {
    const trimmed = key.trim();
    if (!trimmed || trimmed.length > 120) {
      throw new BadRequestException('Invalid setting key');
    }
    if (trimmed.startsWith(USER_TOUR_KEY_PREFIX)) {
      throw new BadRequestException(
        'Per-user tour settings must be accessed via /settings/me',
      );
    }
    return trimmed;
  }

  async findAll(): Promise<AppSetting[]> {
    const items = await this.prisma.appSetting.findMany({
      where: {
        NOT: {
          key: { startsWith: USER_TOUR_KEY_PREFIX },
        },
      },
      orderBy: { key: 'asc' },
    });
    return items.map((s) => this.sanitizeSetting(s));
  }

  async findPublicSettingByKey(key: string): Promise<AppSetting> {
    const validKey = this.assertPublicSettingKey(key);
    return this.findByKey(validKey);
  }

  async findByKey(key: string): Promise<AppSetting> {
    const setting = await this.prisma.appSetting.findUnique({
      where: { key },
    });
    if (!setting) {
      throw new NotFoundException(`Setting with key "${key}" not found`);
    }
    return this.sanitizeSetting(setting);
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

  async getOptionalValue(key: string): Promise<string | null> {
    const setting = await this.prisma.appSetting.findUnique({
      where: { key },
      select: { value: true },
    });
    if (setting?.value == null) {
      return null;
    }
    return String(setting.value);
  }

  async getNumber(key: string, defaultValue: number): Promise<number> {
    const raw = await this.getOptionalValue(key);
    if (raw == null) {
      return defaultValue;
    }
    const n = Number(String(raw).trim());
    return Number.isFinite(n) ? n : defaultValue;
  }

  async isMobilePushEnabled(): Promise<boolean> {
    const notificationsPushEnabled = await this.getBoolean(
      SETTINGS_KEYS.notificationsPushEnabled,
      true,
    );
    const compatMobilePushEnabled = await this.getBoolean(
      SETTINGS_KEYS.mobilePushCompat,
      true,
    );
    return notificationsPushEnabled && compatMobilePushEnabled;
  }

  async isPushCampaignsEnabled(): Promise<boolean> {
    return this.isMobilePushEnabled();
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
    const emailEnabled = await this.getBoolean(SETTINGS_KEYS.emailEnabled, true);
    const smtpProvider = await this.prisma.appSetting
      .findUnique({ where: { key: SETTINGS_KEYS.smtpProvider }, select: { value: true } })
      .then((r) => r?.value ?? null);
    const smtpUser = await this.prisma.appSetting
      .findUnique({ where: { key: SETTINGS_KEYS.smtpUser }, select: { value: true } })
      .then((r) => r?.value ?? null);
    const smtpPass = await this.prisma.appSetting
      .findUnique({ where: { key: SETTINGS_KEYS.smtpPass }, select: { value: true } })
      .then((r) => r?.value ?? null);

    const provider = (smtpProvider ?? 'custom').trim().toLowerCase();
    const smtpConfigured =
      !emailEnabled || provider === 'disabled'
        ? true
        : Boolean(smtpUser?.trim()) && Boolean(smtpPass?.trim());

    const requiredKeys = [
      SETTINGS_KEYS.emailEnabled,
      SETTINGS_KEYS.smtpProvider,
      SETTINGS_KEYS.mobilePushCompat,
      SETTINGS_KEYS.notificationsPushEnabled,
      SETTINGS_KEYS.notificationsEmailEnabled,
      SETTINGS_KEYS.notificationsInAppEnabled,
    ];
    const existing = await this.prisma.appSetting.findMany({
      where: { key: { in: requiredKeys } },
      select: { key: true },
    });
    const existingSet = new Set(existing.map((e) => e.key));
    const missingKeys: string[] = requiredKeys.filter((k) => !existingSet.has(k));

    if (emailEnabled && provider !== 'disabled' && (!smtpUser?.trim() || !smtpPass?.trim())) {
      missingKeys.push(SETTINGS_KEYS.smtpUser, SETTINGS_KEYS.smtpPass);
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
    const value = enabled ? 'true' : 'false';
    await this.upsert(
      SETTINGS_KEYS.notificationsPushEnabled,
      {
        value,
        description: 'Globalni toggle za push notifikacije (mobile).',
      },
      ctx,
    );
    return this.upsert(
      SETTINGS_KEYS.mobilePushCompat,
      {
        value,
        description:
          'Kompatibilnost: globalni toggle koji koristi endpoint /settings/mobile-push.',
      },
      ctx,
    );
  }

  async getNotificationChannelSettings(): Promise<{
    pushEnabled: boolean;
    emailEnabled: boolean;
    inAppEnabled: boolean;
  }> {
    const pushEnabled = await this.getBoolean(SETTINGS_KEYS.notificationsPushEnabled, true);
    const emailEnabled = await this.getBoolean(SETTINGS_KEYS.notificationsEmailEnabled, true);
    const inAppEnabled = await this.getBoolean(SETTINGS_KEYS.notificationsInAppEnabled, true);
    return { pushEnabled, emailEnabled, inAppEnabled };
  }

  async setNotificationChannelSettings(
    patch: Partial<{ pushEnabled: boolean; emailEnabled: boolean; inAppEnabled: boolean }>,
    ctx?: SettingChangeContext,
  ): Promise<{
    pushEnabled: boolean;
    emailEnabled: boolean;
    inAppEnabled: boolean;
  }> {
    const current = await this.getNotificationChannelSettings();
    const next = {
      pushEnabled: patch.pushEnabled ?? current.pushEnabled,
      emailEnabled: patch.emailEnabled ?? current.emailEnabled,
      inAppEnabled: patch.inAppEnabled ?? current.inAppEnabled,
    };

    const upserts: Array<Promise<AppSetting>> = [];
    if (patch.pushEnabled !== undefined) {
      upserts.push(this.setMobilePushEnabled(next.pushEnabled, ctx));
    }
    if (patch.emailEnabled !== undefined) {
      upserts.push(
        this.upsert(
          SETTINGS_KEYS.notificationsEmailEnabled,
          {
            value: next.emailEnabled ? 'true' : 'false',
            description: 'Globalni toggle za email notifikacije.',
          },
          ctx,
        ),
      );
    }
    if (patch.inAppEnabled !== undefined) {
      upserts.push(
        this.upsert(
          SETTINGS_KEYS.notificationsInAppEnabled,
          {
            value: next.inAppEnabled ? 'true' : 'false',
            description: 'Globalni toggle za in-app notifikacije (web + mobile).',
          },
          ctx,
        ),
      );
    }

    if (upserts.length > 0) {
      await Promise.all(upserts);
    }

    return this.getNotificationChannelSettings();
  }

  private getUserTourKey(userId: string): string {
    return `${USER_TOUR_KEY_PREFIX}${userId}`;
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

  async upsertPublicSetting(
    key: string,
    dto: UpdateSettingDto,
    ctx?: SettingChangeContext,
  ): Promise<AppSetting> {
    const validKey = this.assertPublicSettingKey(key);
    return this.upsert(validKey, dto, ctx);
  }

  async upsert(
    key: string,
    dto: UpdateSettingDto,
    ctx?: SettingChangeContext,
  ): Promise<AppSetting> {
    const existing = await this.prisma.appSetting.findUnique({
      where: { key },
    });

    const isSensitive = this.isSensitiveSettingKey(key);
    if (isSensitive && dto.value === MASKED_SECRET && existing) {
      return this.sanitizeSetting(existing);
    }

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
        oldValue: isSensitive
          ? this.maskSecret(existing?.value)
          : (existing?.value ?? null),
        newValue: isSensitive ? this.maskSecret(setting.value) : setting.value,
        oldDescription: existing?.description ?? null,
        newDescription: setting.description ?? null,
      },
      ipAddress: ctx?.ipAddress,
    });

    return this.sanitizeSetting(setting);
  }

  async update(key: string, dto: UpdateSettingDto): Promise<AppSetting> {
    await this.findByKey(key);
    const updated = await this.prisma.appSetting.update({
      where: { key },
      data: {
        value: dto.value,
        ...(dto.description !== undefined && { description: dto.description }),
      },
    });
    return this.sanitizeSetting(updated);
  }
}
