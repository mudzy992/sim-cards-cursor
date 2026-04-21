import { Module } from '@nestjs/common';
import { MetersController } from './meters.controller';
import { MetersService } from './meters.service';
import { InstallationRecordsModule } from '../installation-records/installation-records.module';
import { MeterTypeDefinitionsModule } from '../meter-type-definitions/meter-type-definitions.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [InstallationRecordsModule, MeterTypeDefinitionsModule, AuthModule],
  controllers: [MetersController],
  providers: [MetersService],
})
export class MetersModule {}
