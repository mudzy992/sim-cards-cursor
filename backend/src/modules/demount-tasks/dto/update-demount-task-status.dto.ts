import { ApiProperty } from '@nestjs/swagger';
import { DemountTaskStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateDemountTaskStatusDto {
  @ApiProperty({ enum: DemountTaskStatus })
  @IsEnum(DemountTaskStatus)
  status!: DemountTaskStatus;
}
