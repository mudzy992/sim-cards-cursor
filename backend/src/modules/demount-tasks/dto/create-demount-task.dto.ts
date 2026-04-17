import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DemountTaskType } from '@prisma/client';
import { IsUUID, IsNotEmpty, IsOptional, IsString, IsEnum } from 'class-validator';

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

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
