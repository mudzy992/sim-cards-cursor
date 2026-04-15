import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsInt, IsUUID, IsDateString } from 'class-validator';

export class CreateMeterDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  serialNumber!: string;

  @ApiPropertyOptional({ description: 'Podružnica – za scope organizacione hijerarhije' })
  @IsUUID()
  @IsOptional()
  branchId?: string;

  @ApiProperty({ description: 'Tip brojila iz kataloga – obavezno' })
  @IsUUID()
  @IsNotEmpty()
  meterTypeDefinitionId!: string;

  @ApiPropertyOptional({ description: 'Godina proizvodnje – operator definiše pri ugradnji' })
  @IsInt()
  @IsOptional()
  year?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ description: 'Lokacija instalacije' })
  @IsString()
  @IsOptional()
  installationAddress?: string;

  @ApiPropertyOptional({ description: 'Datum instalacije' })
  @IsDateString()
  @IsOptional()
  installationDate?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  municipality?: string;

  @ApiPropertyOptional({ description: 'Mjerno mjesto' })
  @IsString()
  @IsOptional()
  measuringPoint?: string;

  @ApiPropertyOptional()
  @IsOptional()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  longitude?: number;

  @ApiPropertyOptional({
    description: 'Dinamička polja definisana za tip brojila (key-value)',
    type: 'object',
  })
  @IsOptional()
  dynamicFieldValues?: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      'SIM kartica za pridruživanje – pretraga po ICCID, unesite ID pronađene kartice',
  })
  @IsUUID()
  @IsOptional()
  simCardId?: string;
}
