import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
} from 'class-validator'
import { MeterFieldType } from '@prisma/client'

export class CreateMeterTypeFieldDto {
  @ApiProperty({ example: 'transformer_ratio' })
  @IsString()
  @IsNotEmpty()
  name!: string

  @ApiProperty({ example: 'Prijenosni omjer' })
  @IsString()
  @IsNotEmpty()
  label!: string

  @ApiProperty({ enum: MeterFieldType, default: MeterFieldType.STRING })
  @IsEnum(MeterFieldType)
  fieldType!: MeterFieldType

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  isRequired?: boolean

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  isOperatorFillable?: boolean

  @ApiPropertyOptional({ example: 'N/A' })
  @IsString()
  @IsOptional()
  defaultValue?: string

  @ApiPropertyOptional({ example: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number
}
