import { Module } from '@nestjs/common';
import { DemountTasksController } from './demount-tasks.controller';
import { DemountTasksService } from './demount-tasks.service';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [ActivityLogModule, NotificationsModule],
  controllers: [DemountTasksController],
  providers: [DemountTasksService],
  exports: [DemountTasksService],
})
export class DemountTasksModule {}
