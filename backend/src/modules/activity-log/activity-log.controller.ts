import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { ApiPaginated } from '../../common/decorators/api-paginated.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ActivityLogService } from './activity-log.service';
import { ActivityLogFilterDto } from './dto/activity-log-filter.dto';

@ApiTags('activity-log')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('activity-log')
export class ActivityLogController {
  constructor(private readonly activityLogService: ActivityLogService) {}

  @Get()
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR)
  @ApiPaginated('Lista aktivnosti')
  @ApiOperation({ summary: 'Lista aktivnosti sistema' })
  findAll(@Query() filter: ActivityLogFilterDto) {
    return this.activityLogService.findAll(filter);
  }
}
