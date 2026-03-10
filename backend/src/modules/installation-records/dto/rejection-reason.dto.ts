
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class RejectionReasonDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  rejectionReason!: string;
}
