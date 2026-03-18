import { Body, Controller, Get, Param, Patch, UseGuards, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { SettingsService } from './settings.service';
import { Request } from 'express';
import { UpdateMySettingsDto } from './dto/update-my-settings.dto';

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @Roles(UserRole.SYSTEM_ADMIN)
  @ApiOperation({ summary: 'Lista svih postavki' })
  findAll() {
    return this.settingsService.findAll();
  }

  @Get('mobile-push')
  @Roles(UserRole.SYSTEM_ADMIN)
  @ApiOperation({ summary: 'Dohvati globalni status mobilnih push notifikacija' })
  async getMobilePush() {
    const enabled = await this.settingsService.isMobilePushEnabled();
    return { enabled };
  }

  @Patch('mobile-push')
  @Roles(UserRole.SYSTEM_ADMIN)
  @ApiOperation({ summary: 'Postavi globalni status mobilnih push notifikacija' })
  async setMobilePush(
    @Body() body: { enabled: boolean },
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress;
    const setting = await this.settingsService.setMobilePushEnabled(body.enabled, {
      userId: user.id,
      ipAddress,
    });
    return { enabled: setting.value === 'true' };
  }

  @Get('me')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR, UserRole.USER)
  @ApiOperation({
    summary: 'Dohvati user-specifične postavke (tour state)',
  })
  getMySettings(@CurrentUser() user: { id: string }) {
    return this.settingsService.getUserTourState(user.id).then((tour) => ({
      tour,
    }));
  }

  @Patch('me')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR, UserRole.USER)
  @ApiOperation({
    summary: 'Ažuriraj user-specifične postavke (tour state)',
  })
  updateMySettings(
    @Body() dto: UpdateMySettingsDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress;

    if (!dto.tour) {
      // Za sada podržavamo samo tour state; ako nema tour polja, samo vratiti trenutno stanje
      return this.settingsService.getUserTourState(user.id).then((tour) => ({
        tour,
      }));
    }

    return this.settingsService.updateUserTourState(user.id, dto.tour, {
      userId: user.id,
      ipAddress,
    }).then((tour) => ({
      tour,
    }));
  }

  @Get(':key')
  @Roles(UserRole.SYSTEM_ADMIN)
  @ApiOperation({ summary: 'Dohvati postavku po ključu' })
  findByKey(@Param('key') key: string) {
    return this.settingsService.findByKey(key);
  }

  @Patch(':key')
  @Roles(UserRole.SYSTEM_ADMIN)
  @ApiOperation({ summary: 'Ažuriraj postavku (upsert)' })
  update(
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress;
    return this.settingsService.upsert(key, dto, {
      userId: user.id,
      ipAddress,
    });
  }
}
