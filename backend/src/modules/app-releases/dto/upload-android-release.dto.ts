import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UploadAndroidReleaseDto {
  @ApiProperty({ example: '1.2.3' })
  @IsString()
  @MaxLength(30)
  versionName!: string;

  @ApiProperty({ example: 123, description: 'Android versionCode (integer)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  versionCode!: number;

  @ApiPropertyOptional({ description: 'Release notes (optional)' })
  @IsOptional()
  @IsString()
  releaseNotes?: string;
}

