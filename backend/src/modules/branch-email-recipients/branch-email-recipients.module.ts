import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { BranchEmailRecipientsController } from './branch-email-recipients.controller'
import { BranchEmailRecipientsService } from './branch-email-recipients.service'

@Module({
  imports: [PrismaModule],
  controllers: [BranchEmailRecipientsController],
  providers: [BranchEmailRecipientsService],
  exports: [BranchEmailRecipientsService],
})
export class BranchEmailRecipientsModule {}
