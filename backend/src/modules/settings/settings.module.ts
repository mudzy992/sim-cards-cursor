import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { SettingsController } from './settings.controller';
import { SettingsPublicController } from './settings.public.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [PrismaModule, ActivityLogModule],
  controllers: [SettingsController, SettingsPublicController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
