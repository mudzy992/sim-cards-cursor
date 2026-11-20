import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional } from 'class-validator';
import type { AnalyticsRange } from '../analytics.service';

export class AnalyticsQueryDto {
  @ApiPropertyOptional({
    enum: ['TODAY', '7_DAYS', '30_DAYS', 'MONTH', 'YEAR', 'CUSTOM'],
  })
  @IsOptional()
  @IsIn(['TODAY', '7_DAYS', '30_DAYS', 'MONTH', 'YEAR', 'CUSTOM'])
  range?: AnalyticsRange;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  to?: string;
}
