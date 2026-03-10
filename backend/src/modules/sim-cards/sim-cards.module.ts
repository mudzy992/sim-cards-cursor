import { Module } from '@nestjs/common';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { SimCardsController } from './sim-cards.controller';
import { SimCardsService } from './sim-cards.service';

@Module({
  imports: [ActivityLogModule],
  controllers: [SimCardsController],
  providers: [SimCardsService],
  exports: [SimCardsService],
})
export class SimCardsModule {}
