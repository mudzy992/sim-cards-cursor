import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateMobilePushDto {
  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;
}
