import { Module } from '@nestjs/common';
import { MeterTypeDefinitionsController } from './meter-type-definitions.controller';
import { MeterTypeDefinitionsService } from './meter-type-definitions.service';

@Module({
  controllers: [MeterTypeDefinitionsController],
  providers: [MeterTypeDefinitionsService],
  exports: [MeterTypeDefinitionsService],
})
export class MeterTypeDefinitionsModule {}
