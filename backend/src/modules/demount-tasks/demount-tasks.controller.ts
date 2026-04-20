import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { DemountTasksService } from './demount-tasks.service';
import { CreateDemountTaskDto } from './dto/create-demount-task.dto';
import { CompleteDemountTaskDto } from './dto/complete-demount-task.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { User, UserRole, DemountTaskStatus } from '@prisma/client';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { toScopeContext } from 'src/common/utils/scope-filter.util';

@ApiTags('Demount Tasks (Zadaci demontaže)')
@Controller('demount-tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DemountTasksController {
  constructor(private readonly demountTasksService: DemountTasksService) {}

  @Post()
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.DIST_ADMIN)
  @ApiOperation({ summary: 'Kreiraj zadatak demontaže – bira operatora' })
  create(
    @Body() dto: CreateDemountTaskDto,
    @CurrentUser() user: User & { distributionId?: string | null; branchId?: string | null; branchModeratorBranchIds?: string[] },
    @Req() req: Request,
  ) {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress;
    const scope = toScopeContext({ ...user, role: user.role });
    return this.demountTasksService.create(dto, user.id, ipAddress, scope);
  }

  @Get('my')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.DIST_ADMIN, UserRole.USER)
  @ApiOperation({ summary: 'Moji zadaci demontaže (za operatora)' })
  findMy(
    @CurrentUser() user: { id: string; role: string; distributionId?: string | null; branchId?: string | null; branchModeratorBranchIds?: string[] },
    @Query('status') status?: DemountTaskStatus,
  ) {
    const scope = toScopeContext({ ...user, role: user.role as UserRole });
    return this.demountTasksService.findMy(user.id, status, scope);
  }

  @Patch(':id/status')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.DIST_ADMIN, UserRole.USER)
  @ApiOperation({ summary: 'Operator: započni / vrati na čekanje (PENDING, IN_PROGRESS)' })
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: DemountTaskStatus },
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress;
    return this.demountTasksService.updateStatus(
      id,
      body.status,
      user.id,
      ipAddress,
    );
  }

  @Post(':id/cancel')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.DIST_ADMIN, UserRole.USER)
  @ApiOperation({ summary: 'Inicijator: otkaži nalog (CANCELLED)' })
  cancel(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress;
    return this.demountTasksService.cancel(id, user, ipAddress);
  }

  @Post(':id/reassign')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.DIST_ADMIN, UserRole.USER)
  @ApiOperation({ summary: 'Inicijator: dodijeli nalog drugom operatoru' })
  reassign(
    @Param('id') id: string,
    @Body() body: { assignedToId: string },
    @CurrentUser() user: User & { distributionId?: string | null; branchId?: string | null; branchModeratorBranchIds?: string[] },
    @Req() req: Request,
  ) {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress;
    const scope = toScopeContext({ ...user, role: user.role as UserRole });
    return this.demountTasksService.reassign(id, body.assignedToId, user, scope, ipAddress);
  }

  @Post(':id/complete')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.DIST_ADMIN, UserRole.USER)
  @ApiOperation({ summary: 'Završi zadatak wizardom (rezolucija + obrazloženje + opcionalno nova SIM)' })
  complete(
    @Param('id') id: string,
    @Body() dto: CompleteDemountTaskDto,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress;
    const scope = toScopeContext({ ...user, role: user.role as UserRole });
    return this.demountTasksService.complete(id, dto, user.id, ipAddress, scope);
  }
}
