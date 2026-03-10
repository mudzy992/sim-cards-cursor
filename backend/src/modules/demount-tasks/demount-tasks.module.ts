import { Module } from '@nestjs/common';
import { DemountTasksController } from './demount-tasks.controller';
import { DemountTasksService } from './demount-tasks.service';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [ActivityLogModule],
  controllers: [DemountTasksController],
  providers: [DemountTasksService],
  exports: [DemountTasksService],
})
export class DemountTasksModule {}
