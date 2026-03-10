import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { RecipientGroupType } from '@prisma/client';

export class UpdateRecipientGroupDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: RecipientGroupType })
  @IsOptional()
  @IsEnum(RecipientGroupType)
  type?: RecipientGroupType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  distributionId?: string;
}
