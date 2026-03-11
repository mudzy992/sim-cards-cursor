import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateShipmentDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  provider!: string;

  @ApiProperty({ example: '2026-03-07T10:00:00.000Z' })
  @IsDateString()
  receivedDate!: string;

  @ApiPropertyOptional({ minimum: 0, description: 'Opciono pri kreiranju; postavlja se pri Excel importu na broj uvezenih kartica' })
  @IsOptional()
  @IsInt()
  @Min(0)
  totalCards?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  originalFileName?: string;

  @ApiPropertyOptional({ description: 'Distribution ID – za scope organizacione hijerarhije' })
  @IsOptional()
  @IsString()
  distributionId?: string;
}
