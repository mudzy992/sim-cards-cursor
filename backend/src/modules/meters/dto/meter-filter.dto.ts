import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
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
}
