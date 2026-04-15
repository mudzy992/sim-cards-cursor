import { PartialType } from '@nestjs/swagger'
import { CreateMeterTypeFieldDto } from './create-meter-type-field.dto'

export class UpdateMeterTypeFieldDto extends PartialType(CreateMeterTypeFieldDto) {}
