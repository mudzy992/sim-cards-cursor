import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DemountCompletionResolution, DemountTaskType } from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  METER_DEMOUNT_CATEGORY_VALUES,
  REMOVED_SIM_DISPOSITION_VALUES,
  type MeterDemountCategoryInput,
  type RemovedSimDispositionInput,
} from './create-demount-task.dto';

export class BulkCreateDemountTaskDto {
  @ApiProperty({ type: [String], description: 'Lista ID-eva brojila (1–100)' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  meterIds!: string[];

  @ApiProperty({ description: 'Operator kojem se šalju zadaci' })
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
    (o: BulkCreateDemountTaskDto) =>
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
