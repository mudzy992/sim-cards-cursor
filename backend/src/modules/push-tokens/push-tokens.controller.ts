import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { PushTokensService } from './push-tokens.service';
import { UserRole } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';
import { IsOptional, IsString } from 'class-validator';

class RegisterPushTokenDto {
  @IsString()
  token!: string;

  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @IsString()
  deviceId?: string;
}

class InvalidatePushTokenDto {
  @IsString()
  token!: string;
}

@ApiTags('push-tokens')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('push-tokens')
export class PushTokensController {
  constructor(private readonly pushTokensService: PushTokensService) {}

  @Post('register')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.DIST_ADMIN, UserRole.USER)
  @ApiOperation({ summary: 'Registruj ili osvježi mobile push token za trenutnog korisnika' })
  register(
    @CurrentUser() user: { id: string },
    @Body() dto: RegisterPushTokenDto,
  ) {
    return this.pushTokensService.register({
      userId: user.id,
      token: dto.token,
      platform: dto.platform,
      deviceId: dto.deviceId,
    });
  }

  @Post('invalidate')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.DIST_ADMIN, UserRole.USER)
  @ApiOperation({ summary: 'Invalidiraj push token za trenutnog korisnika (odjava ili uninstall)' })
  async invalidate(
    @CurrentUser() user: { id: string },
    @Body() dto: InvalidatePushTokenDto,
  ) {
    await this.pushTokensService.invalidateToken(dto.token, user.id);
    return { success: true };
  }
}

