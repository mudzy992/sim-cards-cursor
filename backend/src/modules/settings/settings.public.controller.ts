import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@Controller('settings')
export class SettingsPublicController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('notifications')
  @ApiOperation({
    summary: 'Dohvati globalne postavke notifikacija (push/email/in-app) (public)',
  })
  getNotificationChannelSettings() {
    return this.settingsService.getNotificationChannelSettings();
  }

  @Get('mobile-push')
  @ApiOperation({ summary: 'Dohvati globalni status mobilnih push notifikacija (public)' })
  async getMobilePush() {
    const enabled = await this.settingsService.isMobilePushEnabled();
    return { enabled };
  }
}

