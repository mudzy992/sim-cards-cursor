import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { DistributionsController } from './distributions.controller';
import { DistributionsService } from './distributions.service';

@Module({
  imports: [PrismaModule],
  controllers: [DistributionsController],
  providers: [DistributionsService],
  exports: [DistributionsService],
})
export class DistributionsModule {}
