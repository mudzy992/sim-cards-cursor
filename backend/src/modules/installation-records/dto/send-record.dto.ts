import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEmail, IsOptional, IsUUID } from 'class-validator';

export class SendRecordDto {
  @ApiPropertyOptional({
    description: 'IDs of recipient groups to send to',
    type: [String],
    example: ['uuid-1', 'uuid-2'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  recipientGroupIds?: string[];

  @ApiPropertyOptional({
    description: 'Additional manual email addresses',
    type: [String],
    example: ['extra@example.com'],
  })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  manualEmails?: string[];
}
