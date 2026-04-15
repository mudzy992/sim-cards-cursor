import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { UserRole } from '@prisma/client'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { BranchEmailRecipientsService } from './branch-email-recipients.service'
import { CreateBranchEmailRecipientDto } from './dto/create-branch-email-recipient.dto'
import { UpdateBranchEmailRecipientDto } from './dto/update-branch-email-recipient.dto'

@ApiTags('Branch Email Recipients')
@Controller('branch-email-recipients')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class BranchEmailRecipientsController {
  constructor(private readonly service: BranchEmailRecipientsService) {}

  @Post()
  @Roles('SYSTEM_ADMIN', 'DIST_ADMIN')
  @ApiOperation({ summary: 'Add email recipient to a branch' })
  create(
    @Body() dto: CreateBranchEmailRecipientDto,
    @CurrentUser() user: { role: UserRole; distributionId: string | null },
  ) {
    return this.service.create(dto, user)
  }

  @Get()
  @Roles('SYSTEM_ADMIN', 'DIST_ADMIN')
  @ApiOperation({ summary: 'List email recipients (optionally filter by branchId)' })
  findAll(
    @Query('branchId') branchId: string | undefined,
    @CurrentUser() user: { role: UserRole; distributionId: string | null },
  ) {
    if (branchId) {
      return this.service.findByBranch(branchId, user)
    }
    return this.service.findAll(user)
  }

  @Patch(':id')
  @Roles('SYSTEM_ADMIN', 'DIST_ADMIN')
  @ApiOperation({ summary: 'Update email recipient (toggle active, change label/email)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBranchEmailRecipientDto,
    @CurrentUser() user: { role: UserRole; distributionId: string | null },
  ) {
    return this.service.update(id, dto, user)
  }

  @Delete(':id')
  @Roles('SYSTEM_ADMIN', 'DIST_ADMIN')
  @ApiOperation({ summary: 'Remove email recipient from branch' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { role: UserRole; distributionId: string | null },
  ) {
    return this.service.remove(id, user)
  }
}
