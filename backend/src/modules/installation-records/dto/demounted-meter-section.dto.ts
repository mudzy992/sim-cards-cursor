import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * Demontirano brojilo na terenu – čuva se kao snapshot na zapisniku (bez novog reda u `meters`).
 */
export class DemountedMeterSectionDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  meterTypeDefinitionId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  serialNumber!: string;

  @ApiProperty({ description: 'Godina proizvodnje' })
  @Type(() => Number)
  @IsInt()
  year!: number;

  @ApiProperty({ description: 'Godina baždarenja' })
  @Type(() => Number)
  @IsInt()
  calibrationYear!: number;

  @ApiPropertyOptional({
    description: 'Dinamička polja tipa demontiranog brojila',
    type: 'object',
  })
  @IsOptional()
  dynamicFieldValues?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ description: 'Da li je staro brojilo imalo ugrađenu SIM karticu' })
  @IsBoolean()
  @IsOptional()
  hadIntegratedSim?: boolean;

  @ApiPropertyOptional({ description: 'Napomena ako nema ugrađene SIM ili dodatni opis' })
  @IsString()
  @IsOptional()
  noSimNote?: string;
}
