import { Module } from '@nestjs/common';
import { MetersController } from './meters.controller';
import { MetersService } from './meters.service';
import { InstallationRecordsModule } from '../installation-records/installation-records.module';

@Module({
  imports: [InstallationRecordsModule],
  controllers: [MetersController],
  providers: [MetersService],
})
export class MetersModule {}
