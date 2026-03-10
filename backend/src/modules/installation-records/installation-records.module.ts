
import { Module } from '@nestjs/common';
import { InstallationRecordsService } from './installation-records.service';
import { InstallationRecordsController } from './installation-records.controller';
import { PhotoUploadService } from './photo-upload.service';
import { RecordNumberGenerator } from 'src/common/utils/record-number.generator';
import { PrismaModule } from 'src/prisma/prisma.module';
import { StatusTransitionGuard } from './guards/status-transition.guard';
import { PdfGeneratorService } from 'src/common/utils/pdf-generator.service';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { MailModule } from '../mail/mail.module';
import { RecipientsModule } from '../recipients/recipients.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, ActivityLogModule, MailModule, RecipientsModule, NotificationsModule],
  controllers: [InstallationRecordsController],
  providers: [
    InstallationRecordsService,
    PhotoUploadService,
    RecordNumberGenerator,
    StatusTransitionGuard,
    PdfGeneratorService,
  ],
  exports: [InstallationRecordsService],
})
export class InstallationRecordsModule {}
