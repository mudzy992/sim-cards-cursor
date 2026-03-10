import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as path from 'path';
import { MailService } from './mail.service';

@Module({
  imports: [
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const host = config.get<string>('SMTP_HOST', 'localhost');
        const smtpUser = config.get<string>('SMTP_USER');
        const smtpFrom = config.get<string>('SMTP_FROM');
        // Gmail zahtijeva da From adresa odgovara SMTP_USER; inače vraća 555 Syntax error
        const from =
          host?.includes('gmail.com') && smtpUser
            ? smtpUser
            : smtpFrom || '"SIM Tracker" <noreply@simtracker.local>';
        return {
        transport: {
          host,
          port: config.get<number>('SMTP_PORT', 587),
          secure: config.get<string>('SMTP_SECURE') === 'true',
          auth:
            config.get('SMTP_USER') && config.get('SMTP_PASS')
              ? {
                  user: config.get('SMTP_USER'),
                  pass: config.get('SMTP_PASS'),
                }
              : undefined,
        },
        defaults: {
          from,
        },
        template: {
          dir: path.join(process.cwd(), 'src', 'templates', 'email'),
          adapter: new HandlebarsAdapter(),
          options: {
            strict: true,
          },
        },
      };
      },
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
