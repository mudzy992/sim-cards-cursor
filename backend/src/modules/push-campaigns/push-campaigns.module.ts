import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SettingsModule } from '../settings/settings.module';
import { PushCampaignsController } from './push-campaigns.controller';
import { PushCampaignsService } from './push-campaigns.service';
import { PushReceiptsPoller } from './push-receipts.poller';

@Module({
  imports: [PrismaModule, NotificationsModule, SettingsModule],
  controllers: [PushCampaignsController],
  providers: [PushCampaignsService, PushReceiptsPoller],
  exports: [PushCampaignsService],
})
export class PushCampaignsModule {}

