import { Module } from '@nestjs/common';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { MeterTypeDefinitionsController } from './meter-type-definitions.controller';
import { MeterTypeDefinitionsService } from './meter-type-definitions.service';
import { MeterTypeFieldsService } from './meter-type-fields.service';

@Module({
  imports: [ActivityLogModule],
  controllers: [MeterTypeDefinitionsController],
  providers: [MeterTypeDefinitionsService, MeterTypeFieldsService],
  exports: [MeterTypeDefinitionsService, MeterTypeFieldsService],
})
export class MeterTypeDefinitionsModule {}
