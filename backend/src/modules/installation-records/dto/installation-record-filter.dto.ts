import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { RecordStatus } from '@prisma/client';
import { PaginationDto } from 'src/common/dto/pagination.dto';

export class InstallationRecordFilterDto extends PaginationDto {
  @ApiPropertyOptional({ enum: RecordStatus })
  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;

  @ApiPropertyOptional({ description: 'Filter by meter ID' })
  @IsOptional()
  @IsUUID()
  meterId?: string;
}
