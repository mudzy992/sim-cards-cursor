import { Module } from '@nestjs/common'
import { ActivityLogModule } from '../activity-log/activity-log.module'
import { InstallationRecordsModule } from '../installation-records/installation-records.module'
import { SimCardsModule } from '../sim-cards/sim-cards.module'
import { InstallTasksController } from './install-tasks.controller'
import { InstallTasksService } from './install-tasks.service'

@Module({
  imports: [ActivityLogModule, InstallationRecordsModule, SimCardsModule],
  controllers: [InstallTasksController],
  providers: [InstallTasksService],
  exports: [InstallTasksService],
})
export class InstallTasksModule {}

