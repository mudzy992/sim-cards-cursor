import { ApiPropertyOptional } from '@nestjs/swagger';
import { InstallTaskStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination.dto';

export class InstallTaskFilterDto extends PaginationDto {
  @ApiPropertyOptional({ enum: InstallTaskStatus })
  @IsOptional()
  @IsEnum(InstallTaskStatus)
  status?: InstallTaskStatus;

  @ApiPropertyOptional({ description: 'Samo vraćeni / nedodijeljeni nalozi (assignedToId IS NULL)' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  unassignedOnly?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Pretraga po serijskom broju brojila ili operatoru' })
  @IsOptional()
  @IsString()
  search?: string;
}
