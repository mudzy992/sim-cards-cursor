import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { PushTokensController } from './push-tokens.controller';
import { PushTokensService } from './push-tokens.service';

@Module({
  imports: [PrismaModule],
  controllers: [PushTokensController],
  providers: [PushTokensService],
  exports: [PushTokensService],
})
export class PushTokensModule {}

