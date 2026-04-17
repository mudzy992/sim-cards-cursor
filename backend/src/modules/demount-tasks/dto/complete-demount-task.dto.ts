import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DemountCompletionResolution } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsString,
  IsUUID,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CompleteDemountTaskDto {
  @ApiProperty({ enum: DemountCompletionResolution })
  @IsEnum(DemountCompletionResolution)
  resolution!: DemountCompletionResolution;

  @ApiProperty({ description: 'Obrazloženje demontaže ili zamjene SIM-a' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  reason!: string;

  @ApiPropertyOptional({ description: 'UUID nove SIM kartice (obavezno za REPLACE_SIM)' })
  @ValidateIf((o: CompleteDemountTaskDto) => o.resolution === DemountCompletionResolution.REPLACE_SIM)
  @IsUUID()
  @IsNotEmpty()
  newSimCardId?: string;
}
