import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';
import { MeterType } from '@prisma/client';

export class CreateMeterTypeDefinitionDto {
  @ApiProperty({ example: 'AMM 3.0' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'Landis+Gyr' })
  @IsString()
  @IsOptional()
  manufacturer?: string;

  @ApiPropertyOptional({ example: 'E650' })
  @IsString()
  @IsOptional()
  model?: string;

  @ApiPropertyOptional({ enum: MeterType, default: MeterType.SINGLE_PHASE })
  @IsOptional()
  @IsEnum(MeterType)
  type?: MeterType;

  @ApiPropertyOptional({ example: '60A' })
  @IsString()
  @IsOptional()
  maxCurrent?: string;

  @ApiPropertyOptional({ example: 10, minimum: 1, maximum: 64 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(64)
  serialNumberLength?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
