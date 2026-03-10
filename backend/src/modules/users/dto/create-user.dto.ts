import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole, UserStatus } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'user@simtracker.local' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'Ime' })
  @IsString()
  firstName!: string;

  @ApiProperty({ example: 'Prezime' })
  @IsString()
  lastName!: string;

  @ApiPropertyOptional({ enum: UserRole, default: UserRole.USER })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ enum: UserStatus, default: UserStatus.ACTIVE })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ example: '+38761111222' })
  @IsOptional()
  @Matches(/^\+?[0-9]{7,15}$/)
  phone?: string;

  @ApiPropertyOptional({ description: 'Distribution ID for MODERATOR' })
  @IsOptional()
  @IsUUID()
  distributionId?: string;

  @ApiPropertyOptional({ description: 'Branch ID for USER (operator)' })
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
