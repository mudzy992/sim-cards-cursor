import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import type { Request } from 'express'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { InstallTaskStatus, type User, UserRole } from '@prisma/client'
import { CurrentUser } from 'src/common/decorators/current-user.decorator'
import { Roles } from 'src/common/decorators/roles.decorator'
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard'
import { RolesGuard } from 'src/common/guards/roles.guard'
import { toScopeContext } from 'src/common/utils/scope-filter.util'
import { CreateInstallTaskDto } from './dto/create-install-task.dto'
import { CompleteInstallTaskDto } from './dto/complete-install-task.dto'
import { InstallTasksService } from './install-tasks.service'

@ApiTags('Install Tasks (Zadaci ugradnje SIM)')
@Controller('install-tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class InstallTasksController {
  constructor(private readonly installTasksService: InstallTasksService) {}

  @Post()
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.DIST_ADMIN, UserRole.USER)
  @ApiOperation({ summary: 'Kreiraj zadatak ugradnje SIM-a (samo za NO_SIM brojilo)' })
  create(
    @Body() dto: CreateInstallTaskDto,
    @CurrentUser() user: User & { distributionId?: string | null; branchId?: string | null; branchModeratorBranchIds?: string[] },
    @Req() req: Request,
  ) {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress
    const scope = toScopeContext({ ...user, role: user.role })
    return this.installTasksService.create(dto, user.id, scope, ipAddress)
  }

  @Get('my')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.DIST_ADMIN, UserRole.USER)
  @ApiOperation({ summary: 'Moji install zadaci (za operatora)' })
  findMy(
    @CurrentUser() user: { id: string; role: string; distributionId?: string | null; branchId?: string | null; branchModeratorBranchIds?: string[] },
    @Query('status') status?: InstallTaskStatus,
  ) {
    const scope = toScopeContext({ ...user, role: user.role as UserRole })
    return this.installTasksService.findMy(user.id, status, scope)
  }

  @Patch(':id/status')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.DIST_ADMIN, UserRole.USER)
  @ApiOperation({ summary: 'Ažuriraj status (PENDING, IN_PROGRESS, CANCELLED) — ne koristiti COMPLETED' })
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: InstallTaskStatus },
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress
    return this.installTasksService.updateStatus(id, body.status, user.id, ipAddress)
  }

  @Post(':id/complete')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.DIST_ADMIN, UserRole.USER)
  @ApiOperation({ summary: 'Završi zadatak ugradnje (SIM + zapisnik)' })
  complete(
    @Param('id') id: string,
    @Body() dto: CompleteInstallTaskDto,
    @CurrentUser() user: User & { distributionId?: string | null; branchId?: string | null; branchModeratorBranchIds?: string[] },
    @Req() req: Request,
  ) {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress
    const scope = toScopeContext({ ...user, role: user.role as UserRole })
    return this.installTasksService.complete(id, dto, user.id, scope, ipAddress)
  }
}

