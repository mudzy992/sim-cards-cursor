import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator'

export class CompleteInstallTaskDto {
  @ApiProperty({ description: 'SIM kartica koja se ugrađuje' })
  @IsUUID()
  simCardId!: string

  @ApiPropertyOptional({ description: 'Godina baždarenja (kada je brojilo bilo na baždarenju)' })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  calibrationYear?: number

  @ApiPropertyOptional({ description: 'Lokacija instalacije (kada je brojilo demontirano sa lokacije)' })
  @IsString()
  @IsOptional()
  installationAddress?: string

  @ApiPropertyOptional({ description: 'Datum instalacije (YYYY-MM-DD ili ISO)' })
  @IsDateString()
  @IsOptional()
  installationDate?: string

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  city?: string

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  municipality?: string

  @ApiPropertyOptional({ description: 'Mjerno mjesto' })
  @IsString()
  @IsOptional()
  measuringPoint?: string

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  latitude?: number

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  longitude?: number

  @ApiPropertyOptional({
    description: 'Dinamička polja po tipu brojila (key-value)',
    type: 'object',
  })
  @IsObject()
  @IsOptional()
  dynamicFieldValues?: Record<string, unknown>

  @ApiProperty({ required: false, description: 'Opcionalna napomena za zapisnik ugradnje' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  recordNotes?: string
}

