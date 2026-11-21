import { Module } from '@nestjs/common';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { AuthModule } from '../auth/auth.module';
import { InstallationRecordsModule } from '../installation-records/installation-records.module';
import { MeterTypeDefinitionsModule } from '../meter-type-definitions/meter-type-definitions.module';
import { MetersController } from './meters.controller';
import { MetersService } from './meters.service';

@Module({
  imports: [
    InstallationRecordsModule,
    MeterTypeDefinitionsModule,
    AuthModule,
    ActivityLogModule,
  ],
  controllers: [MetersController],
  providers: [MetersService],
})
export class MetersModule {}
