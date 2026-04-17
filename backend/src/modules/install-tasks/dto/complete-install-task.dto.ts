import { ApiProperty } from '@nestjs/swagger'
import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator'

export class CompleteInstallTaskDto {
  @ApiProperty({ description: 'SIM kartica koja se ugrađuje' })
  @IsUUID()
  simCardId!: string

  @ApiProperty({ required: false, description: 'Opcionalna napomena za zapisnik ugradnje' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  recordNotes?: string
}

