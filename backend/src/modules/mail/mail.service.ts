import { Injectable, Logger } from '@nestjs/common';
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

  private renderTemplate(templateName: string, context: Record<string, unknown>): string {
    const cacheKey = templateName;
    const cached = this.templateCache.get(cacheKey);
    if (cached) return cached(context);

    const filePath = path.join(this.getTemplatesDir(), `${templateName}.hbs`);
    const source = fs.readFileSync(filePath, 'utf-8');
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

    const html = this.renderTemplate(template, context);
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
}
