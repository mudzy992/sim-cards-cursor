import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class ReorderMeterTypeFieldsDto {
  @ApiProperty({ type: [String], description: 'Ordered list of meter type field IDs' })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  fieldIds!: string[];
}
