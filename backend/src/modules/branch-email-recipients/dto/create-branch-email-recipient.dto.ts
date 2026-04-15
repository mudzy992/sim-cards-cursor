import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsEmail, IsOptional, IsString, IsUUID } from 'class-validator'

export class CreateBranchEmailRecipientDto {
  @ApiProperty({ description: 'Branch ID to add the email recipient for' })
  @IsUUID()
  branchId!: string

  @ApiProperty({ description: 'Email address of the recipient', example: 'user@example.com' })
  @IsEmail()
  email!: string

  @ApiPropertyOptional({ description: 'Optional label/description for this recipient' })
  @IsOptional()
  @IsString()
  label?: string
}
