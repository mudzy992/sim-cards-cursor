import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import * as path from 'path';
import * as fs from 'fs';
import Handlebars from 'handlebars';

export interface SendApprovalRequestOptions {
  to: string | string[];
  recordNumber: string;
  recordId: string;
  meterSerialNumber: string;
  ipAddress: string;
  installationAddress: string;
  municipality: string;
  installedByName: string;
}

export interface SendRecordEmailOptions {
  to: string | string[];
  subject: string;
  recordNumber: string;
  recordId: string;
  pdfBuffer: Buffer;
  pdfFileName: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly templateCache = new Map<string, Handlebars.TemplateDelegate>();
  private readonly allowedTemplateNames = [
    'installation-record-approval-request',
    'installation-record-notification',
  ] as const;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private async getSetting(key: string): Promise<string | null> {
    const row = await this.prisma.appSetting.findUnique({
      where: { key },
      select: { value: true },
    });
    return row?.value ?? null;
  }

  private async getBooleanSetting(key: string, fallback: boolean): Promise<boolean> {
    const raw = await this.getSetting(key);
    if (raw == null) return fallback;
    const v = String(raw).trim().toLowerCase();
    if (v === 'true') return true;
    if (v === 'false') return false;
    return fallback;
  }

  private async getNumberSetting(key: string, fallback: number): Promise<number> {
    const raw = await this.getSetting(key);
    if (raw == null) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  }

  private async getSmtpTransport(): Promise<{
    transporter: Transporter;
    from: string;
    replyTo?: string;
  } | null> {
    const emailNotificationsEnabled = await this.getBooleanSetting(
      'notifications.email.enabled',
      true,
    );
    if (!emailNotificationsEnabled) {
      this.logger.warn(
        'Email notifications disabled by app setting: notifications.email.enabled=false',
      );
      return null;
    }

    const emailEnabled = await this.getBooleanSetting('email.enabled', true);
    if (!emailEnabled) {
      this.logger.warn('Email sending disabled by app setting: email.enabled=false');
      return null;
    }

    const provider = (await this.getSetting('smtp.provider'))?.trim().toLowerCase() ?? 'custom';
    if (provider === 'disabled') {
      this.logger.warn('Email sending disabled by app setting: smtp.provider=disabled');
      return null;
    }

    const defaults =
      provider === 'google'
        ? { host: 'smtp.gmail.com', port: 465, secure: true, requireTLS: true }
        : provider === 'office365'
          ? { host: 'smtp.office365.com', port: 587, secure: false, requireTLS: true }
          : { host: 'localhost', port: 587, secure: false, requireTLS: false };

    const host = (await this.getSetting('smtp.host'))?.trim() || defaults.host;
    const port = await this.getNumberSetting('smtp.port', defaults.port);
    const secure = await this.getBooleanSetting('smtp.secure', defaults.secure);
    const requireTLS = await this.getBooleanSetting('smtp.requireTLS', defaults.requireTLS);
    const user = (await this.getSetting('smtp.user'))?.trim() || undefined;
    const pass = (await this.getSetting('smtp.pass')) ?? undefined;

    const fromName = (await this.getSetting('smtp.fromName'))?.trim() || 'SIM Tracker';
    const fromAddress =
      (await this.getSetting('smtp.fromAddress'))?.trim() ||
      (user && host.includes('gmail.com') ? user : 'noreply@simtracker.local');
    const replyTo = (await this.getSetting('smtp.replyTo'))?.trim() || undefined;

    // Gmail zahtijeva da From adresa odgovara SMTP_USER; inače vraća 555 Syntax error
    const effectiveFrom =
      host.includes('gmail.com') && user ? user : `"${fromName}" <${fromAddress}>`;

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
      ...(requireTLS ? { requireTLS: true } : {}),
    });

    return { transporter, from: effectiveFrom, replyTo };
  }

  private getTemplatesDir(): string {
    // Copied into runtime image at /usr/app/templates/email
    return path.join(process.cwd(), 'templates', 'email');
  }

  private getTemplateSettingKey(templateName: string): string {
    return `email.templates.${templateName}.hbs`;
  }

  private assertAllowedTemplate(name: string): void {
    if (!this.allowedTemplateNames.includes(name as (typeof this.allowedTemplateNames)[number])) {
      throw new BadRequestException(
        `Template "${name}" is not supported. Allowed: ${this.allowedTemplateNames.join(', ')}`,
      );
    }
  }

  private async getTemplateSource(templateName: string): Promise<{
    source: string;
    sourceType: 'db' | 'file';
  }> {
    this.assertAllowedTemplate(templateName);
    const key = this.getTemplateSettingKey(templateName);
    const row = await this.prisma.appSetting.findUnique({
      where: { key },
      select: { value: true },
    });
    const dbValue = row?.value ?? null;
    if (dbValue && dbValue.trim()) {
      return { source: dbValue, sourceType: 'db' };
    }

    const filePath = path.join(this.getTemplatesDir(), `${templateName}.hbs`);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(`Template "${templateName}" not found`);
    }
    return { source: fs.readFileSync(filePath, 'utf-8'), sourceType: 'file' };
  }

  private async renderTemplate(templateName: string, context: Record<string, unknown>): Promise<string> {
    const cacheKey = templateName;
    const cached = this.templateCache.get(cacheKey);
    if (cached) return cached(context);

    const { source } = await this.getTemplateSource(templateName);
    const compiled = Handlebars.compile(source, { strict: true });
    this.templateCache.set(cacheKey, compiled);
    return compiled(context);
  }

  async sendApprovalRequest(options: SendApprovalRequestOptions): Promise<void> {
    const { to, recordNumber, recordId, meterSerialNumber, ipAddress, installationAddress, municipality, installedByName } =
      options;
    const recipients = Array.isArray(to) ? to : [to];
    const appUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:5173');
    await this.sendMail({
      to: recipients,
      subject: `Zapisnik ${recordNumber} – čeka odobrenje`,
      template: 'installation-record-approval-request',
      context: {
        recordNumber,
        recordId,
        meterSerialNumber,
        ipAddress,
        installationAddress: installationAddress || '–',
        municipality: municipality || '–',
        installedByName,
        appUrl,
      },
    });
    this.logger.log(`Approval request for ${recordNumber} sent to ${recipients.join(', ')}`);
  }

  async sendRecordWithPdf(options: SendRecordEmailOptions): Promise<void> {
    const { to, subject, recordNumber, recordId, pdfBuffer, pdfFileName } =
      options;
    const recipients = Array.isArray(to) ? to : [to];

    await this.sendMail({
      to: recipients,
      subject,
      template: 'installation-record-notification',
      context: {
        recordNumber,
        recordId,
      },
      attachments: [
        {
          filename: pdfFileName,
          content: pdfBuffer,
        },
      ],
    });

    this.logger.log(
      `Record ${recordNumber} sent to ${recipients.join(', ')}`,
    );
  }

  async sendMail(options: {
    to: string | string[];
    subject: string;
    template: string;
    context?: Record<string, unknown>;
    attachments?: { filename: string; content: Buffer }[];
  }): Promise<void> {
    const { to, subject, template, context = {}, attachments } = options;
    const recipients = Array.isArray(to) ? to : [to];

    const transport = await this.getSmtpTransport();
    if (!transport) {
      this.logger.warn(`Email skipped (disabled). Subject="${subject}" to="${recipients.join(', ')}"`);
      return;
    }

    const html = await this.renderTemplate(template, context);
    await transport.transporter.sendMail({
      to: recipients,
      from: transport.from,
      ...(transport.replyTo ? { replyTo: transport.replyTo } : {}),
      subject,
      html,
      attachments,
    });

    this.logger.log(`Email sent to ${recipients.join(', ')}`);
  }

  async listTemplates(): Promise<
    { name: string; key: string; sourceType: 'db' | 'file'; content: string }[]
  > {
    const names = [...this.allowedTemplateNames];
    const result = [];
    for (const name of names) {
      // eslint-disable-next-line no-await-in-loop
      const { source, sourceType } = await this.getTemplateSource(name);
      result.push({ name, key: this.getTemplateSettingKey(name), sourceType, content: source });
    }
    return result;
  }

  async getTemplate(name: string): Promise<{ name: string; key: string; sourceType: 'db' | 'file'; content: string }> {
    const safe = String(name ?? '').trim();
    if (!safe) throw new BadRequestException('Missing template name');
    this.assertAllowedTemplate(safe);
    const { source, sourceType } = await this.getTemplateSource(safe);
    return { name: safe, key: this.getTemplateSettingKey(safe), sourceType, content: source };
  }

  async updateTemplate(name: string, content: string): Promise<{ name: string; key: string; sourceType: 'db'; content: string }> {
    const safe = String(name ?? '').trim();
    if (!safe) throw new BadRequestException('Missing template name');
    this.assertAllowedTemplate(safe);
    if (safe.includes('..') || safe.includes('/') || safe.includes('\\')) {
      throw new BadRequestException('Invalid template name');
    }
    const key = this.getTemplateSettingKey(safe);
    const value = String(content ?? '');
    await this.prisma.appSetting.upsert({
      where: { key },
      create: { key, value, description: `Email template override: ${safe}` },
      update: { value },
    });
    this.templateCache.delete(safe);
    return { name: safe, key, sourceType: 'db', content: value };
  }

  async previewTemplate(
    name: string,
    context: Record<string, unknown>,
  ): Promise<{ name: string; html: string }> {
    const safe = String(name ?? '').trim();
    if (!safe) throw new BadRequestException('Missing template name');
    this.assertAllowedTemplate(safe);
    if (safe.includes('..') || safe.includes('/') || safe.includes('\\')) {
      throw new BadRequestException('Invalid template name');
    }
    const html = await this.renderTemplate(safe, context);
    return { name: safe, html };
  }

  async sendTestEmail(input: {
    to: string;
    template: string;
    subject?: string;
    context?: Record<string, unknown>;
  }): Promise<{ ok: true }> {
    const to = String(input.to ?? '').trim();
    if (!to) throw new BadRequestException('Missing "to"');
    const template = String(input.template ?? '').trim();
    if (!template) throw new BadRequestException('Missing "template"');
    this.assertAllowedTemplate(template);
    const subject = String(input.subject ?? `Test email (${template})`);

    await this.sendMail({
      to,
      subject,
      template,
      context: input.context ?? { recordNumber: 'TEST-001', recordId: 'test', appUrl: this.config.get<string>('FRONTEND_URL', '') },
    });
    return { ok: true };
  }
}
