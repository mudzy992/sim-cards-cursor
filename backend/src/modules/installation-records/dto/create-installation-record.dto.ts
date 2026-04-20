import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsUUID,
  IsNotEmpty,
  IsDateString,
  IsNumber,
  IsInt,
  IsArray,
  IsEnum,
  ValidateNested,
} from 'class-validator';
import { InstallationRecordKind } from '@prisma/client';
import { DemountedMeterSectionDto } from './demounted-meter-section.dto';

export class CreateInstallationRecordDto {
  @ApiPropertyOptional({
    description: 'Idempotency ključ (mobilni offline queue). Ponovni zahtjev sa istim ključem vraća isti zapisnik.',
  })
  @IsString()
  @IsOptional()
  clientRequestId?: string;

  @ApiPropertyOptional({
    enum: InstallationRecordKind,
    default: InstallationRecordKind.NEW_CONNECTION,
  })
  @IsEnum(InstallationRecordKind)
  @IsOptional()
  kind?: InstallationRecordKind;

  @ApiPropertyOptional({
    type: DemountedMeterSectionDto,
    description: 'Obavezno kada je kind = METER_REPLACEMENT',
  })
  @ValidateNested()
  @Type(() => DemountedMeterSectionDto)
  @IsOptional()
  demountedMeter?: DemountedMeterSectionDto;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  simCardId!: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  installedById!: string;

  /** Postojeće brojilo – koristiti ili meterId ili (meterTypeDefinitionId + serialNumber). */
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  meterId?: string;

  /** Tip brojila – za novo brojilo na terenu (uz serialNumber). */
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  meterTypeDefinitionId?: string;

  /** Serijski broj – za novo brojilo na terenu (operator ga definiše pri montaži). */
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  serialNumber?: string;

  @ApiPropertyOptional({ description: 'Godina proizvodnje – operator definiše pri ugradnji' })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  year?: number;

  @ApiPropertyOptional({ description: 'Godina baždarenja – operator definiše pri ugradnji' })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  calibrationYear?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  installationAddress?: string;

  @ApiPropertyOptional()
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

  /** ID podružnice (opštine) – za operatora se automatski uzima iz profila; moderator može poslati kada bira iz padajućeg menija */
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  branchId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  measuringPoint?: string;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  latitude?: number;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  longitude?: number;

  @ApiPropertyOptional({
    description: 'Dinamička polja definisana za tip brojila (key-value)',
    type: 'object',
  })
  @IsOptional()
  dynamicFieldValues?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Putanje do fotografija (npr. ["installation-records/xxx.jpg"])',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];
}
