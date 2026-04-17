import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationChannelsDto {
  @ApiPropertyOptional({ description: 'Enable/disable push notifications (global)' })
  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Enable/disable email notifications (global)' })
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Enable/disable in-app notifications (global)' })
  @IsOptional()
  @IsBoolean()
  inAppEnabled?: boolean;
}

