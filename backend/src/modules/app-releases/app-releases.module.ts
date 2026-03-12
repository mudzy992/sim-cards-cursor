import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AppReleasesController } from './app-releases.controller';
import { AppReleasesService } from './app-releases.service';

@Module({
  imports: [PrismaModule],
  controllers: [AppReleasesController],
  providers: [AppReleasesService],
  exports: [AppReleasesService],
})
export class AppReleasesModule {}

