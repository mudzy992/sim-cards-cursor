import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class AssignSimCardDto {
  @ApiProperty()
  @IsString()
  userId!: string;
}
