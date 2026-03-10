import { PartialType } from '@nestjs/swagger';
import { CreateSimCardDto } from './create-sim-card.dto';

export class UpdateSimCardDto extends PartialType(CreateSimCardDto) {}
