import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './modules/auth/auth.module';
import { ActivityLogModule } from './modules/activity-log/activity-log.module';
import { ShipmentsModule } from './modules/shipments/shipments.module';
import { SimCardsModule } from './modules/sim-cards/sim-cards.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { AppThrottleGuard } from './common/guards/throttle.guard';
import { MetersModule } from './modules/meters/meters.module';
import { MeterTypeDefinitionsModule } from './modules/meter-type-definitions/meter-type-definitions.module';
import { InstallationRecordsModule } from './modules/installation-records/installation-records.module';
import { DemountTasksModule } from './modules/demount-tasks/demount-tasks.module';
import { DistributionsModule } from './modules/distributions/distributions.module';
import { BranchesModule } from './modules/branches/branches.module';
import { FilesModule } from './modules/files/files.module';
import { MailModule } from './modules/mail/mail.module';
import { SettingsModule } from './modules/settings/settings.module';
import { RecipientsModule } from './modules/recipients/recipients.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { PushTokensModule } from './modules/push-tokens/push-tokens.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { PushCampaignsModule } from './modules/push-campaigns/push-campaigns.module';
import { AppReleasesModule } from './modules/app-releases/app-releases.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    PrismaModule,
    AuthModule,
    UsersModule,
    ActivityLogModule,
    ShipmentsModule,
    SimCardsModule,
    MetersModule,
    MeterTypeDefinitionsModule,
    InstallationRecordsModule,
    DemountTasksModule,
    DistributionsModule,
    BranchesModule,
    FilesModule,
    MailModule,
    SettingsModule,
    RecipientsModule,
    NotificationsModule,
    DashboardModule,
    PushTokensModule,
    AnalyticsModule,
    PushCampaignsModule,
    AppReleasesModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AppThrottleGuard,
    },
  ],
})
export class AppModule {}
