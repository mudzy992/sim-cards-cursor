import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { BranchModeratorsController } from './branch-moderators.controller'
import { BranchModeratorsService } from './branch-moderators.service'

@Module({
  imports: [PrismaModule],
  controllers: [BranchModeratorsController],
  providers: [BranchModeratorsService],
  exports: [BranchModeratorsService],
})
export class BranchModeratorsModule {}
