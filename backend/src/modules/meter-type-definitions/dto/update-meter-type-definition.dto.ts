import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum } from 'class-validator';
import { MeterType } from '@prisma/client';

export class UpdateMeterTypeDefinitionDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  manufacturer?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  model?: string;

  @ApiPropertyOptional({ enum: MeterType })
  @IsOptional()
  @IsEnum(MeterType)
  type?: MeterType;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  maxCurrent?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
