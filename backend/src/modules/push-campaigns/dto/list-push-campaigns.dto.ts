import { ApiPropertyOptional } from '@nestjs/swagger';
import { PushCampaignStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListPushCampaignsDto {
  @ApiPropertyOptional({ enum: PushCampaignStatus })
  @IsOptional()
  @IsEnum(PushCampaignStatus)
  status?: PushCampaignStatus;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

