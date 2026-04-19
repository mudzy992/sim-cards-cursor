import { ApiPropertyOptional } from '@nestjs/swagger';
import { MeterSimCardState } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination.dto';

export class MeterFilterDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter po tipu brojila (UUID)' })
  @IsOptional()
  @IsString()
  meterTypeDefinitionId?: string;

  @ApiPropertyOptional({ description: 'Pretraga po serijskom broju (LIKE)' })
  @IsOptional()
  @IsString()
  serialNumber?: string;

  @ApiPropertyOptional({ enum: MeterSimCardState, description: 'Filter po stanju SIM-a na brojilu' })
  @IsOptional()
  @IsEnum(MeterSimCardState)
  simCardState?: MeterSimCardState;
}
