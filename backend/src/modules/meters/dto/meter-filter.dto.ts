import { ApiPropertyOptional } from '@nestjs/swagger';
import { MeterSimCardState, MeterStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
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

  @ApiPropertyOptional({ enum: MeterStatus, description: 'Filter po statusu brojila' })
  @IsOptional()
  @IsEnum(MeterStatus)
  status?: MeterStatus;

  @ApiPropertyOptional({ description: 'Filter po podružnici (UUID)' })
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
