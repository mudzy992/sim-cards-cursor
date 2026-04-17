import { ApiProperty } from '@nestjs/swagger'
import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator'

export class CreateInstallTaskDto {
  @ApiProperty()
  @IsUUID()
  meterId!: string

  @ApiProperty({ description: 'Operator kojem se dodjeljuje zadatak' })
  @IsUUID()
  assignedToId!: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  notes?: string
}

