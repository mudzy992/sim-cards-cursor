import { PartialType } from '@nestjs/swagger';
import { CreateDistributionDto } from './create-distribution.dto';

export class UpdateDistributionDto extends PartialType(CreateDistributionDto) {}
