import {
  Body,
  Controller,
  Delete,
  Get,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Meter, User, UserRole } from '@prisma/client';
import { Request } from 'express';
import { ApiPaginated } from 'src/common/decorators/api-paginated.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { toScopeContext } from 'src/common/utils/scope-filter.util';
import { InstallationRecordsService } from '../installation-records/installation-records.service';
import { CreateMeterDto } from './dto/create-meter.dto';
import { DeleteMeterDto } from './dto/delete-meter.dto';
import { MeterFilterDto } from './dto/meter-filter.dto';
import { UpdateMeterDto } from './dto/update-meter.dto';
import { MetersService } from './meters.service';

type RequestUser = {
  id?: string;
  role: string;
  distributionId?: string | null;
  branchId?: string | null;
  branchModeratorBranchIds?: string[];
};

@ApiTags('Meters')
@Controller('meters')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class MetersController {
  constructor(
    private readonly metersService: MetersService,
    private readonly installationRecordsService: InstallationRecordsService,
  ) {}

  @Post()
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.DIST_ADMIN)
  @ApiOperation({ summary: 'Create a new meter' })
  @ApiResponse({ status: 201, description: 'The meter has been successfully created.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  async create(
    @Body() createMeterDto: CreateMeterDto,
    @CurrentUser()
    user: User & {
      distributionId?: string | null;
      branchId?: string | null;
      branchModeratorBranchIds?: string[];
    },
    @Req() req: Request,
    @Ip() ip: string,
  ): Promise<Meter> {
    const scope = toScopeContext(user);
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      ip;
    const { simCardId, ...meterData } = createMeterDto;
    const meter = await this.metersService.create(
      meterData as CreateMeterDto,
      scope,
      user?.id,
      ipAddress,
    );
    if (simCardId && user?.id) {
      try {
        await this.installationRecordsService.create(
          {
            simCardId,
            meterId: meter.id,
            installedById: user.id,
          },
          {
            userId: user.id,
            ipAddress,
            role: user.role,
            distributionId: user.distributionId ?? null,
            branchId: user.branchId ?? null,
            branchModeratorBranchIds: user.branchModeratorBranchIds ?? [],
          },
        );
      } catch (error) {
        await this.metersService.rollbackUnlinkedMeter(meter.id);
        throw error;
      }
    }
    return meter;
  }

  @Get()
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.DIST_ADMIN, UserRole.USER)
  @ApiPaginated()
  @ApiOperation({ summary: 'Get all meters' })
  findAll(@Query() filter: MeterFilterDto, @CurrentUser() user?: RequestUser) {
    const scope = toScopeContext(user ? { ...user, role: user.role as UserRole } : null);
    return this.metersService.findAll(filter, scope);
  }

  @Get('available')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.DIST_ADMIN, UserRole.USER)
  @ApiOperation({ summary: 'Get all available meters' })
  @ApiResponse({ status: 200, description: 'Return all available meters.' })
  findAvailable(
    @CurrentUser() user?: RequestUser,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
  ): Promise<Meter[]> {
    const scope = toScopeContext(user ? { ...user, role: user.role as UserRole } : null);
    const parsedLimit = limit ? Number(limit) : undefined;
    return this.metersService.findAvailable(scope, {
      search,
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    });
  }

  @Get(':id')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.DIST_ADMIN, UserRole.USER)
  @ApiOperation({ summary: 'Get a meter by ID' })
  @ApiResponse({ status: 200, description: 'Return the meter.' })
  @ApiResponse({ status: 404, description: 'Meter not found.' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user?: RequestUser,
  ): Promise<Meter> {
    const scope = toScopeContext(user ? { ...user, role: user.role as UserRole } : null);
    return this.metersService.findOne(id, scope);
  }

  @Patch(':id')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.DIST_ADMIN)
  @ApiOperation({ summary: 'Update a meter' })
  @ApiResponse({ status: 200, description: 'The meter has been successfully updated.' })
  @ApiResponse({ status: 404, description: 'Meter not found.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateMeterDto: UpdateMeterDto,
    @CurrentUser() user?: RequestUser,
    @Ip() ipAddress?: string,
  ): Promise<Meter> {
    const scope = toScopeContext(user ? { ...user, role: user.role as UserRole } : null);
    return this.metersService.update(id, updateMeterDto, scope, user?.id, ipAddress);
  }

  @Get(':id/delete-summary')
  @Roles(UserRole.SYSTEM_ADMIN)
  @ApiOperation({ summary: 'Get meter delete summary (SYSTEM_ADMIN)' })
  getDeleteSummary(@Param('id', ParseUUIDPipe) id: string) {
    return this.metersService.getDeleteSummary(id);
  }

  @Post(':id/delete')
  @Roles(UserRole.SYSTEM_ADMIN)
  @ApiOperation({ summary: 'Delete meter with confirmation (SYSTEM_ADMIN)' })
  deleteWithConfirm(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeleteMeterDto,
    @CurrentUser('id') userId: string,
    @Req() req: Request,
  ) {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress;
    return this.metersService.deleteWithConfirm(id, dto, { userId, ipAddress });
  }

  @Delete(':id')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.DIST_ADMIN)
  @ApiOperation({ summary: 'Delete a meter' })
  @ApiResponse({ status: 200, description: 'The meter has been successfully deleted.' })
  @ApiResponse({ status: 404, description: 'Meter not found.' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user?: RequestUser,
  ): Promise<Meter> {
    const scope = toScopeContext(user ? { ...user, role: user.role as UserRole } : null);
    return this.metersService.remove(id, scope);
  }
}
