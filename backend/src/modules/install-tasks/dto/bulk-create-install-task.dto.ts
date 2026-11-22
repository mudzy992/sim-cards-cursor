import { ApiProperty } from '@nestjs/swagger'
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator'

export class BulkCreateInstallTaskDto {
  @ApiProperty({ type: [String], description: 'Lista ID-eva brojila (1–100)' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  meterIds!: string[]

  @ApiProperty({ description: 'Operator kojem se dodjeljuju zadaci' })
  @IsUUID()
  assignedToId!: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  notes?: string
}
