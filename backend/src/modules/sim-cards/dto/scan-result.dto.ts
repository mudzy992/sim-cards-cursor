import { ApiProperty } from '@nestjs/swagger';
import { SimCardStatus } from '@prisma/client';

export class ScanResultDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  iccid!: string;

  @ApiProperty()
  ipAddress!: string;

  @ApiProperty({ nullable: true })
  publicIpAddress!: string | null;

  @ApiProperty({ enum: SimCardStatus })
  status!: SimCardStatus;

  @ApiProperty({ nullable: true })
  shipmentName!: string | null;
}
