import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateRecipientDto {
  @ApiProperty({ example: 'primalac@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Ime' })
  @IsString()
  firstName!: string;

  @ApiProperty({ example: 'Prezime' })
  @IsString()
  lastName!: string;

  @ApiPropertyOptional({ example: 'Tehničar' })
  @IsOptional()
  @IsString()
  position?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ description: 'Recipient group ID' })
  @IsUUID()
  groupId!: string;
}
