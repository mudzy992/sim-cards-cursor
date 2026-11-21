import { ApiPropertyOptional } from '@nestjs/swagger';
import { RecordStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
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

  @ApiPropertyOptional({ description: 'Filter by meter branch ID' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Search by recordNumber, meter serialNumber or SIM ICCID' })
  @IsOptional()
  @IsString()
  search?: string;
}
