import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsOptional, IsEnum, IsInt, Min, Max, ValidateIf } from 'class-validator';
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

  @ApiPropertyOptional({ example: 10, minimum: 1, maximum: 64, nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(64)
  serialNumberLength?: number | null;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
