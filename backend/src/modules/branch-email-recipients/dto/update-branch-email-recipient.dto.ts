import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator'

export class UpdateBranchEmailRecipientDto {
  @ApiPropertyOptional({ description: 'Email address of the recipient' })
  @IsOptional()
  @IsEmail()
  email?: string

  @ApiPropertyOptional({ description: 'Optional label/description' })
  @IsOptional()
  @IsString()
  label?: string

  @ApiPropertyOptional({ description: 'Whether this recipient is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}
