import { ApiPropertyOptional } from '@nestjs/swagger';
import { SimCardStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class SimCardFilterDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: SimCardStatus })
  @IsOptional()
  @IsEnum(SimCardStatus)
  status?: SimCardStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shipmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedToId?: string;
}
