import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { ParseUUIDPipe } from '@nestjs/common';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { toScopeContext } from 'src/common/utils/scope-filter.util';
import { CreatePushCampaignDto } from './dto/create-push-campaign.dto';
import { ListPushCampaignsDto } from './dto/list-push-campaigns.dto';
import { PushCampaignsService } from './push-campaigns.service';

@ApiTags('push-campaigns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('push-campaigns')
export class PushCampaignsController {
  constructor(private readonly service: PushCampaignsService) {}

  @Post()
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Kreiraj draft push kampanju' })
  createDraft(
    @CurrentUser()
    user: { id: string; role: UserRole; distributionId?: string | null; branchId?: string | null },
    @Body() dto: CreatePushCampaignDto,
  ) {
    const actor = { id: user.id, ...toScopeContext(user)! };
    return this.service.createDraft({
      actor,
      title: dto.title,
      message: dto.message,
      deepLink: dto.deepLink,
      audienceType: dto.audienceType,
      filters: dto.filters,
      targetUserId: dto.targetUserId,
    });
  }

  @Post(':id/send')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Pošalji push kampanju' })
  send(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser()
    user: { id: string; role: UserRole; distributionId?: string | null; branchId?: string | null },
  ) {
    const actor = { id: user.id, ...toScopeContext(user)! };
    return this.service.sendCampaign(id, actor);
  }

  @Get()
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Lista push kampanja' })
  list(
    @Query() query: ListPushCampaignsDto,
    @CurrentUser()
    user: { id: string; role: UserRole; distributionId?: string | null; branchId?: string | null },
  ) {
    const actor = { id: user.id, ...toScopeContext(user)! };
    return this.service.list(query, actor);
  }

  @Get(':id')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Detalji kampanje' })
  getOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser()
    user: { id: string; role: UserRole; distributionId?: string | null; branchId?: string | null },
  ) {
    const actor = { id: user.id, ...toScopeContext(user)! };
    return this.service.getOne(id, actor);
  }

  @Get(':id/stats')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Statistika dostave kampanje' })
  stats(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser()
    user: { id: string; role: UserRole; distributionId?: string | null; branchId?: string | null },
  ) {
    const actor = { id: user.id, ...toScopeContext(user)! };
    return this.service.getStats(id, actor);
  }

  @Get(':id/recipients')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Lista recipienta i statusa dostave' })
  recipients(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser()
    user: { id: string; role: UserRole; distributionId?: string | null; branchId?: string | null },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const actor = { id: user.id, ...toScopeContext(user)! };
    return this.service.listRecipients(id, actor, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }
}

