import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class ReassignDemountTaskDto {
  @ApiProperty({ description: 'UUID novog operatora kojem se nalog dodjeljuje' })
  @IsUUID()
  assignedToId!: string;
}
