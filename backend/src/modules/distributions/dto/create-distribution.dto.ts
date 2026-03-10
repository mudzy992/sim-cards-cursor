import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class CreateDistributionDto {
  @ApiProperty({ example: 'ED Zenica' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @ApiProperty({ example: 'EDZ' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  @Matches(/^[A-Za-z0-9_-]+$/, { message: 'Code must be alphanumeric, underscore or hyphen' })
  code!: string;
}
