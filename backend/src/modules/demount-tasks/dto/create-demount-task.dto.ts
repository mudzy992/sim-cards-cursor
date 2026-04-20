import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DemountCompletionResolution, DemountTaskType } from '@prisma/client';
import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateIf,
} from 'class-validator';

export const REMOVED_SIM_DISPOSITION_VALUES = ['MARK_DEFECTIVE', 'RETURN_TO_STOCK'] as const;
export type RemovedSimDispositionInput = (typeof REMOVED_SIM_DISPOSITION_VALUES)[number];

export const METER_DEMOUNT_CATEGORY_VALUES = [
  'METER_FAULTY',
  'TEMPORARY_REMOVAL',
  'MAINTENANCE',
  'OTHER',
] as const;
export type MeterDemountCategoryInput = (typeof METER_DEMOUNT_CATEGORY_VALUES)[number];

export class CreateDemountTaskDto {
  @ApiProperty({ description: 'Brojilo sa kojeg se demontira SIM' })
  @IsUUID()
  @IsNotEmpty()
  meterId!: string;

  @ApiProperty({ description: 'Operator kojem se šalje zadatak' })
  @IsUUID()
  @IsNotEmpty()
  assignedToId!: string;

  @ApiPropertyOptional({ enum: DemountTaskType, default: DemountTaskType.DEMOUNT_SIM })
  @IsEnum(DemountTaskType)
  @IsOptional()
  taskType?: DemountTaskType;

  @ApiProperty({ enum: DemountCompletionResolution, description: 'Rezolucija demontaže (inicijator)' })
  @IsEnum(DemountCompletionResolution)
  @IsNotEmpty()
  requestedResolution!: DemountCompletionResolution;

  @ApiProperty({ description: 'Obrazloženje demontaže / zamjene (inicijator)' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  requestedReason!: string;

  @ApiProperty({
    enum: REMOVED_SIM_DISPOSITION_VALUES,
    description: 'Ishod uklonjene SIM kartice (inicijator)',
  })
  @IsIn([...REMOVED_SIM_DISPOSITION_VALUES])
  @IsNotEmpty()
  requestedRemovedSimDisposition!: RemovedSimDispositionInput;

  @ApiPropertyOptional({
    enum: METER_DEMOUNT_CATEGORY_VALUES,
    description: 'Obavezno kada brojilo ostaje bez SIM-a (FULL_DEMOUNT ili REMOVE_SIM_ONLY)',
  })
  @ValidateIf(
    (o: CreateDemountTaskDto) =>
      o.requestedResolution === DemountCompletionResolution.FULL_DEMOUNT ||
      o.requestedResolution === DemountCompletionResolution.REMOVE_SIM_ONLY,
  )
  @IsIn([...METER_DEMOUNT_CATEGORY_VALUES])
  @IsNotEmpty()
  requestedMeterDemountCategory?: MeterDemountCategoryInput;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
