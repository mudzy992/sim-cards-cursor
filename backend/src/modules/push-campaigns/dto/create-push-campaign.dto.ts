import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PushCampaignAudienceType } from '@prisma/client';
import { IsEnum, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreatePushCampaignDto {
  @ApiProperty({ maxLength: 150 })
  @IsString()
  @MaxLength(150)
  title!: string;

  @ApiProperty()
  @IsString()
  message!: string;

  @ApiPropertyOptional({ description: 'Deep link route (e.g. /(app)/notifications)' })
  @IsOptional()
  @IsString()
  @MaxLength(191)
  deepLink?: string;

  @ApiProperty({ enum: PushCampaignAudienceType })
  @IsEnum(PushCampaignAudienceType)
  audienceType!: PushCampaignAudienceType;

  @ApiPropertyOptional({ description: 'JSON filters (for audienceType=FILTER)' })
  @IsOptional()
  @IsObject()
  filters?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Target user id (for audienceType=USER)' })
  @IsOptional()
  @IsUUID()
  targetUserId?: string;
}

