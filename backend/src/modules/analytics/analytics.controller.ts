import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import {
  AnalyticsRange,
  AnalyticsService,
  TimeRangeParams,
} from './analytics.service';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  private buildRangeParams(query: {
    range?: string;
    from?: string;
    to?: string;
  }): TimeRangeParams {
    const range = query.range as AnalyticsRange | undefined;
    return {
      range,
      from: query.from,
      to: query.to,
    };
  }

  @Get('overview')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR, UserRole.USER)
  @ApiOperation({ summary: 'Pregled ključnih KPI-jeva (overview)' })
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  getOverview(
    @CurrentUser()
    user: { role: string; distributionId?: string | null; branchId?: string | null },
    @Query() query: { range?: string; from?: string; to?: string },
  ) {
    const scope = {
      role: user.role as UserRole,
      distributionId: user.distributionId ?? null,
      branchId: user.branchId ?? null,
    };
    const params = this.buildRangeParams(query);
    return this.analyticsService.getOverview(params, scope);
  }

  @Get('installation-records')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR, UserRole.USER)
  @ApiOperation({ summary: 'Analitika zapisnika (funnel + timeline)' })
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  getInstallationRecordsAnalytics(
    @CurrentUser()
    user: { role: string; distributionId?: string | null; branchId?: string | null },
    @Query() query: { range?: string; from?: string; to?: string },
  ) {
    const scope = {
      role: user.role as UserRole,
      distributionId: user.distributionId ?? null,
      branchId: user.branchId ?? null,
    };
    const params = this.buildRangeParams(query);
    return this.analyticsService.getInstallationRecordsAnalytics(params, scope);
  }

  @Get('sim-cards')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR, UserRole.USER)
  @ApiOperation({ summary: 'Analitika SIM kartica po statusima' })
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  getSimCardsAnalytics(
    @CurrentUser()
    user: { role: string; distributionId?: string | null; branchId?: string | null },
    @Query() query: { range?: string; from?: string; to?: string },
  ) {
    const scope = {
      role: user.role as UserRole,
      distributionId: user.distributionId ?? null,
      branchId: user.branchId ?? null,
    };
    const params = this.buildRangeParams(query);
    return this.analyticsService.getSimCardsAnalytics(params, scope);
  }

  @Get('users')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR, UserRole.USER)
  @ApiOperation({ summary: 'Analitika aktivnosti po korisnicima' })
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  getUsersAnalytics(
    @CurrentUser()
    user: { role: string; distributionId?: string | null; branchId?: string | null },
    @Query() query: { range?: string; from?: string; to?: string },
  ) {
    const scope = {
      role: user.role as UserRole,
      distributionId: user.distributionId ?? null,
      branchId: user.branchId ?? null,
    };
    const params = this.buildRangeParams(query);
    return this.analyticsService.getUsersAnalytics(params, scope);
  }

  @Get('exports/:report.csv')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR, UserRole.USER)
  @ApiOperation({ summary: 'CSV export analitičkih izvještaja' })
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async exportCsv(
    @Param('report') report: 'overview' | 'sim-cards' | 'installation-records' | 'users',
    @CurrentUser()
    user: { role: string; distributionId?: string | null; branchId?: string | null },
    @Query() query: { range?: string; from?: string; to?: string },
    @Res() res: Response,
  ) {
    const scope = {
      role: user.role as UserRole,
      distributionId: user.distributionId ?? null,
      branchId: user.branchId ?? null,
    };
    const params = this.buildRangeParams(query);
    const { filename, content } = await this.analyticsService.getExportCsv(
      report,
      params,
      scope,
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    res.send(content);
  }
}

