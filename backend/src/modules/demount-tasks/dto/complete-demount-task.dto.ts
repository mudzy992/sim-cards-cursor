import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DemountCompletionResolution } from '@prisma/client';
import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsString,
  IsUUID,
  MinLength,
  ValidateIf,
} from 'class-validator';

/** String literal values — koristi @IsIn umjesto @IsEnum(Prisma) da whitelist uvijek radi i ako je Prisma client zastario. */
export const REMOVED_SIM_DISPOSITION_VALUES = ['MARK_DEFECTIVE', 'RETURN_TO_STOCK'] as const;
export type RemovedSimDispositionInput = (typeof REMOVED_SIM_DISPOSITION_VALUES)[number];

export const METER_DEMOUNT_CATEGORY_VALUES = [
  'METER_FAULTY',
  'TEMPORARY_REMOVAL',
  'MAINTENANCE',
  'OTHER',
] as const;
export type MeterDemountCategoryInput = (typeof METER_DEMOUNT_CATEGORY_VALUES)[number];

export class CompleteDemountTaskDto {
  @ApiProperty({ enum: DemountCompletionResolution })
  @IsEnum(DemountCompletionResolution)
  resolution!: DemountCompletionResolution;

  @ApiProperty({ description: 'Obrazloženje demontaže ili zamjene SIM-a' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  reason!: string;

  @ApiProperty({
    enum: REMOVED_SIM_DISPOSITION_VALUES,
    description: 'Šta uraditi sa uklonjenom SIM karticom',
  })
  @IsIn([...REMOVED_SIM_DISPOSITION_VALUES])
  removedSimDisposition!: RemovedSimDispositionInput;

  @ApiPropertyOptional({
    enum: METER_DEMOUNT_CATEGORY_VALUES,
    description: 'Obavezno kada brojilo ostaje bez SIM-a (FULL_DEMOUNT ili REMOVE_SIM_ONLY)',
  })
  @ValidateIf(
    (o: CompleteDemountTaskDto) =>
      o.resolution === DemountCompletionResolution.FULL_DEMOUNT ||
      o.resolution === DemountCompletionResolution.REMOVE_SIM_ONLY,
  )
  @IsIn([...METER_DEMOUNT_CATEGORY_VALUES])
  @IsNotEmpty()
  meterDemountCategory?: MeterDemountCategoryInput;

  @ApiPropertyOptional({ description: 'UUID nove SIM kartice (obavezno za REPLACE_SIM)' })
  @ValidateIf((o: CompleteDemountTaskDto) => o.resolution === DemountCompletionResolution.REPLACE_SIM)
  @IsUUID()
  @IsNotEmpty()
  newSimCardId?: string;
}
