import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { RecipientGroupType } from '@prisma/client';

export class CreateRecipientGroupDto {
  @ApiProperty({ example: 'Operativni tim' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: 'Primaoci za operativne zapisnike' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: RecipientGroupType, default: RecipientGroupType.PDF })
  @IsOptional()
  @IsEnum(RecipientGroupType)
  type?: RecipientGroupType;

  @ApiPropertyOptional({ description: 'Distribution ID – za moderatora, grupa pripada ovoj distribuciji' })
  @IsOptional()
  @IsUUID()
  distributionId?: string;
}
