import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength, Matches, IsUUID } from 'class-validator';

export class CreateBranchDto {
  @ApiProperty()
  @IsUUID()
  distributionId!: string;

  @ApiProperty({ example: 'Zenica' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @ApiProperty({ example: 'ZEN' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  @Matches(/^[A-Za-z0-9_-]+$/, { message: 'Code must be alphanumeric, underscore or hyphen' })
  code!: string;
}
