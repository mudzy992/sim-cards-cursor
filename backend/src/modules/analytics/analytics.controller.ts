import {
  BadRequestException,
  Controller,
  ForbiddenException,
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
  isScopedAdminOrModerator,
  toScopeContext,
} from 'src/common/utils/scope-filter.util';
import { AnalyticsService, TimeRangeParams } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

type ScopedUser = {
  id?: string;
  role: string;
  distributionId?: string | null;
  branchId?: string | null;
  branchModeratorBranchIds?: string[];
};

const VALID_REPORTS = ['overview', 'sim-cards', 'installation-records', 'users'] as const;
type ReportType = (typeof VALID_REPORTS)[number];

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  private buildRangeParams(query: AnalyticsQueryDto): TimeRangeParams {
    return {
      range: query.range,
      from: query.from,
      to: query.to,
    };
  }

  @Get('overview')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.DIST_ADMIN, UserRole.USER)
  @ApiOperation({ summary: 'Pregled ključnih KPI-jeva (overview)' })
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  getOverview(
    @CurrentUser() user: ScopedUser,
    @Query() query: AnalyticsQueryDto,
  ) {
    const scope = toScopeContext({ ...user, role: user.role as UserRole });
    return this.analyticsService.getOverview(this.buildRangeParams(query), scope);
  }

  @Get('installation-records')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.DIST_ADMIN, UserRole.USER)
  @ApiOperation({ summary: 'Analitika zapisnika (funnel + timeline)' })
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  getInstallationRecordsAnalytics(
    @CurrentUser() user: ScopedUser,
    @Query() query: AnalyticsQueryDto,
  ) {
    const scope = toScopeContext({ ...user, role: user.role as UserRole });
    return this.analyticsService.getInstallationRecordsAnalytics(
      this.buildRangeParams(query),
      scope,
    );
  }

  @Get('sim-cards')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.DIST_ADMIN, UserRole.USER)
  @ApiOperation({ summary: 'Analitika SIM kartica po statusima' })
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  getSimCardsAnalytics(
    @CurrentUser() user: ScopedUser,
    @Query() query: AnalyticsQueryDto,
  ) {
    const scope = toScopeContext({ ...user, role: user.role as UserRole });
    return this.analyticsService.getSimCardsAnalytics(
      this.buildRangeParams(query),
      scope,
    );
  }

  @Get('users')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.DIST_ADMIN, UserRole.USER)
  @ApiOperation({ summary: 'Analitika aktivnosti po korisnicima' })
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  getUsersAnalytics(
    @CurrentUser() user: ScopedUser,
    @Query() query: AnalyticsQueryDto,
  ) {
    const scope = toScopeContext({ ...user, role: user.role as UserRole });
    if (!isScopedAdminOrModerator(scope)) {
      throw new ForbiddenException(
        'Only administrators and branch moderators can access user analytics',
      );
    }
    return this.analyticsService.getUsersAnalytics(
      this.buildRangeParams(query),
      scope,
    );
  }

  @Get('exports/:report.csv')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.DIST_ADMIN, UserRole.USER)
  @ApiOperation({ summary: 'CSV export analitičkih izvještaja' })
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async exportCsv(
    @Param('report') report: string,
    @CurrentUser() user: ScopedUser,
    @Query() query: AnalyticsQueryDto,
    @Res() res: Response,
  ) {
    if (!VALID_REPORTS.includes(report as ReportType)) {
      throw new BadRequestException('Unsupported report type');
    }
    const scope = toScopeContext({ ...user, role: user.role as UserRole });
    if (report === 'users' && !isScopedAdminOrModerator(scope)) {
      throw new ForbiddenException(
        'Only administrators and branch moderators can export user analytics',
      );
    }
    const { filename, content } = await this.analyticsService.getExportCsv(
      report as ReportType,
      this.buildRangeParams(query),
      scope,
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(content);
  }
}
