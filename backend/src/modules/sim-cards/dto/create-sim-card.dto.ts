import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SimCardStatus } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class CreateSimCardDto {
  @ApiProperty({ description: 'ICCID barkod vrijednost' })
  @IsString()
  @Matches(/^\d{10,30}$/)
  iccid!: string;

  @ApiProperty({ description: 'Privatna IP adresa' })
  @IsString()
  ipAddress!: string;

  @ApiPropertyOptional({ description: 'Javna IP adresa' })
  @IsOptional()
  @IsString()
  publicIpAddress?: string;

  @ApiPropertyOptional({ description: 'Broj telefona' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({ description: 'APN' })
  @IsOptional()
  @IsString()
  apn?: string;

  @ApiProperty({ description: 'Shipment ID' })
  @IsString()
  shipmentId!: string;

  @ApiPropertyOptional({ enum: SimCardStatus, default: SimCardStatus.AVAILABLE })
  @IsOptional()
  @IsEnum(SimCardStatus)
  status?: SimCardStatus;
}
