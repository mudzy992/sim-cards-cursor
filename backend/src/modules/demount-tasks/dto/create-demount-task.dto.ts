import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateDemountTaskDto {
  @ApiProperty({ description: 'Brojilo sa kojeg se demontira SIM' })
  @IsUUID()
  @IsNotEmpty()
  meterId!: string;

  @ApiProperty({ description: 'Operator kojem se šalje zadatak' })
  @IsUUID()
  @IsNotEmpty()
  assignedToId!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
