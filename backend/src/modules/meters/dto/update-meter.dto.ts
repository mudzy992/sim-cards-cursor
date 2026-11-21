import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateMeterDto } from './create-meter.dto';

export class UpdateMeterDto extends PartialType(
  OmitType(CreateMeterDto, ['simCardId', 'simCardState'] as const),
) {}
