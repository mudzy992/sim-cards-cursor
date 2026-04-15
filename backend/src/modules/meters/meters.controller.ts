
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { MetersService } from './meters.service';
import { CreateMeterDto } from './dto/create-meter.dto';
import { UpdateMeterDto } from './dto/update-meter.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Meter, UserRole } from '@prisma/client';
import { MeterFilterDto } from './dto/meter-filter.dto';
import { ApiPaginated } from 'src/common/decorators/api-paginated.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { User } from '@prisma/client';
import { InstallationRecordsService } from '../installation-records/installation-records.service';

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
    @CurrentUser() user: User & { distributionId?: string | null; branchId?: string | null },
    @Req() req: Request,
  ): Promise<Meter> {
    const { simCardId, ...meterData } = createMeterDto;
    const meter = await this.metersService.create(meterData as CreateMeterDto);
    if (simCardId && user?.id) {
      const ipAddress =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.socket?.remoteAddress;
      await this.installationRecordsService.create(
        {
          simCardId,
          meterId: meter.id,
          installedById: user.id,
        },
        { userId: user.id, ipAddress },
      );
    }
    return meter;
  }

  @Get()
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.DIST_ADMIN)
  @ApiPaginated()
  @ApiOperation({ summary: 'Get all meters' })
  findAll(@Query() filter: MeterFilterDto, @CurrentUser() user?: { role: string; distributionId?: string | null; branchId?: string | null }) {
    const scope = user ? { role: user.role as UserRole, distributionId: user.distributionId ?? null, branchId: user.branchId ?? null } : null;
    return this.metersService.findAll(filter, scope);
  }

  @Get('available')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.DIST_ADMIN, UserRole.USER)
  @ApiOperation({ summary: 'Get all available meters' })
  @ApiResponse({ status: 200, description: 'Return all available meters.'})
  findAvailable(@CurrentUser() user?: { role: string; distributionId?: string | null; branchId?: string | null }): Promise<Meter[]> {
    const scope = user ? { role: user.role as UserRole, distributionId: user.distributionId ?? null, branchId: user.branchId ?? null } : null;
    return this.metersService.findAvailable(scope);
  }

  @Get(':id')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.DIST_ADMIN)
  @ApiOperation({ summary: 'Get a meter by ID' })
  @ApiResponse({ status: 200, description: 'Return the meter.' })
  @ApiResponse({ status: 404, description: 'Meter not found.' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user?: { role: string; distributionId?: string | null; branchId?: string | null }): Promise<Meter> {
    const scope = user ? { role: user.role as UserRole, distributionId: user.distributionId ?? null, branchId: user.branchId ?? null } : null;
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
    @CurrentUser() user?: { role: string; distributionId?: string | null; branchId?: string | null },
  ): Promise<Meter> {
    const scope = user ? { role: user.role as UserRole, distributionId: user.distributionId ?? null, branchId: user.branchId ?? null } : null;
    return this.metersService.update(id, updateMeterDto, scope);
  }

  @Delete(':id')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.DIST_ADMIN)
  @ApiOperation({ summary: 'Delete a meter' })
  @ApiResponse({ status: 200, description: 'The meter has been successfully deleted.' })
  @ApiResponse({ status: 404, description: 'Meter not found.' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user?: { role: string; distributionId?: string | null; branchId?: string | null }): Promise<Meter> {
    const scope = user ? { role: user.role as UserRole, distributionId: user.distributionId ?? null, branchId: user.branchId ?? null } : null;
    return this.metersService.remove(id, scope);
  }
}

