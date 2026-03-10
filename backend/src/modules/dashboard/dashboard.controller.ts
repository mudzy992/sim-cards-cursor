import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR, UserRole.USER)
  @ApiOperation({ summary: 'Dashboard statistike' })
  getStats(
    @CurrentUser() user: { role: string; distributionId?: string | null; branchId?: string | null },
  ) {
    const scope = user
      ? {
          role: user.role as UserRole,
          distributionId: user.distributionId ?? null,
          branchId: user.branchId ?? null,
        }
      : null;
    return this.dashboardService.getStats(scope);
  }

  @Get('recent-records')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR, UserRole.USER)
  @ApiOperation({ summary: 'Nedavni zapisnici' })
  getRecentRecords(
    @CurrentUser() user: { role: string; distributionId?: string | null; branchId?: string | null },
    @Query('limit') limit?: string,
  ) {
    const scope = user
      ? {
          role: user.role as UserRole,
          distributionId: user.distributionId ?? null,
          branchId: user.branchId ?? null,
        }
      : null;
    return this.dashboardService.getRecentRecords(
      limit ? parseInt(limit, 10) : 10,
      scope,
    );
  }

  @Get('records-chart')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR, UserRole.USER)
  @ApiOperation({ summary: 'Graf zapisnika po danima' })
  getRecordsChart(
    @CurrentUser() user: { role: string; distributionId?: string | null; branchId?: string | null },
    @Query('days') days?: string,
  ) {
    const scope = user
      ? {
          role: user.role as UserRole,
          distributionId: user.distributionId ?? null,
          branchId: user.branchId ?? null,
        }
      : null;
    return this.dashboardService.getRecordsChart(
      days ? parseInt(days, 10) : 30,
      scope,
    );
  }
}
