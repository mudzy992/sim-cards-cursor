import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class ReassignInstallTaskDto {
  @ApiProperty({ description: 'UUID novog operatora kojem se nalog dodjeljuje' })
  @IsUUID()
  assignedToId!: string;
}
