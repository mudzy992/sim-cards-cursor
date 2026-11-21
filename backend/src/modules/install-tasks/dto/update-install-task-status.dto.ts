import { ApiProperty } from '@nestjs/swagger';
import { InstallTaskStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateInstallTaskStatusDto {
  @ApiProperty({ enum: InstallTaskStatus })
  @IsEnum(InstallTaskStatus)
  status!: InstallTaskStatus;
}
