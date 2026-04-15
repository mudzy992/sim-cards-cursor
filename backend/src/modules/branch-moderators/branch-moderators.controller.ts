import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { UserRole } from '@prisma/client'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { BranchModeratorsService } from './branch-moderators.service'
import { AssignBranchModeratorDto } from './dto/assign-branch-moderator.dto'

@Controller('branch-moderators')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BranchModeratorsController {
  constructor(private readonly service: BranchModeratorsService) {}

  @Post()
  @Roles('SYSTEM_ADMIN', 'DIST_ADMIN')
  assign(
    @Body() dto: AssignBranchModeratorDto,
    @CurrentUser() user: { role: UserRole; distributionId: string | null },
  ) {
    return this.service.assign(dto, user)
  }

  @Delete(':id')
  @Roles('SYSTEM_ADMIN', 'DIST_ADMIN')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: { role: UserRole; distributionId: string | null },
  ) {
    return this.service.remove(id, user)
  }

  @Get()
  @Roles('SYSTEM_ADMIN', 'DIST_ADMIN')
  findAll(
    @Query('branchId') branchId: string | undefined,
    @Query('userId') userId: string | undefined,
    @CurrentUser() user: { role: UserRole; distributionId: string | null },
  ) {
    if (branchId) {
      return this.service.findByBranch(branchId, user)
    }
    if (userId) {
      return this.service.findByUser(userId)
    }
    return this.service.findAll(user)
  }
}
