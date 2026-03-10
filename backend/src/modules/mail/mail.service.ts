import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@nestjs-modules/mailer';

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

  constructor(
    private readonly mailer: MailerService,
    private readonly config: ConfigService,
  ) {}

  async sendApprovalRequest(options: SendApprovalRequestOptions): Promise<void> {
    const { to, recordNumber, recordId, meterSerialNumber, ipAddress, installationAddress, municipality, installedByName } =
      options;
    const recipients = Array.isArray(to) ? to : [to];
    const appUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:5173');
    await this.mailer.sendMail({
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

    await this.mailer.sendMail({
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

    await this.mailer.sendMail({
      to: recipients,
      subject,
      template,
      context,
      attachments,
    });

    this.logger.log(`Email sent to ${recipients.join(', ')}`);
  }
}
