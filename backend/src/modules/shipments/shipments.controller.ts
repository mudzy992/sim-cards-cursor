import {
  Body,
  Controller,
  Delete,
  Get,
  Ip,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiPaginated } from '../../common/decorators/api-paginated.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { ImportExcelDto } from './dto/import-excel.dto';
import { ShipmentFilterDto } from './dto/shipment-filter.dto';
import { UpdateShipmentDto } from './dto/update-shipment.dto';
import { ShipmentsService } from './shipments.service';

@ApiTags('shipments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR)
@Controller('shipments')
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @Get()
  @ApiPaginated('Lista isporuka')
  findAll(@Query() filter: ShipmentFilterDto, @CurrentUser() user?: { role: string; distributionId?: string | null; branchId?: string | null }) {
    const scope = user ? { role: user.role as UserRole, distributionId: user.distributionId ?? null, branchId: user.branchId ?? null } : null;
    return this.shipmentsService.findAll(filter, scope);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalji isporuke' })
  findOne(@Param('id') id: string, @CurrentUser() user?: { role: string; distributionId?: string | null; branchId?: string | null }) {
    const scope = user ? { role: user.role as UserRole, distributionId: user.distributionId ?? null, branchId: user.branchId ?? null } : null;
    return this.shipmentsService.findOne(id, scope);
  }

  @Post()
  @Roles(UserRole.SYSTEM_ADMIN)
  @ApiOperation({ summary: 'Kreiranje isporuke (samo SYSTEM_ADMIN)' })
  create(
    @Body() dto: CreateShipmentDto,
    @CurrentUser() user: { id: string; role: string; distributionId?: string | null; branchId?: string | null },
    @Ip() ipAddress: string,
  ) {
    const scope = { role: user.role as UserRole, distributionId: user.distributionId ?? null, branchId: user.branchId ?? null };
    return this.shipmentsService.create(dto, user.id, ipAddress, scope);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Ažuriranje isporuke' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateShipmentDto,
    @CurrentUser() user: { id: string; role: string; distributionId?: string | null; branchId?: string | null },
    @Ip() ipAddress: string,
  ) {
    const scope = { role: user.role as UserRole, distributionId: user.distributionId ?? null, branchId: user.branchId ?? null };
    return this.shipmentsService.update(id, dto, user.id, ipAddress, scope);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Brisanje isporuke' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string; distributionId?: string | null; branchId?: string | null },
    @Ip() ipAddress: string,
  ) {
    const scope = { role: user.role as UserRole, distributionId: user.distributionId ?? null, branchId: user.branchId ?? null };
    return this.shipmentsService.remove(id, user.id, ipAddress, scope);
  }

  @Get(':id/sim-cards')
  @ApiPaginated('SIM kartice po isporuci')
  findShipmentSimCards(@Param('id') id: string, @Query() pagination: PaginationDto, @CurrentUser() user?: { role: string; distributionId?: string | null; branchId?: string | null }) {
    const scope = user ? { role: user.role as UserRole, distributionId: user.distributionId ?? null, branchId: user.branchId ?? null } : null;
    return this.shipmentsService.findShipmentSimCards(id, pagination, scope);
  }

  @Post(':id/import')
  @Roles(UserRole.SYSTEM_ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Import Excel/CSV fajla (preview ili apply)' })
  @Throttle({ default: { limit: 10, ttl: 600_000 } })
  importExcel(
    @Param('id') id: string,
    @Body() dto: ImportExcelDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: { id: string; role: string; distributionId?: string | null; branchId?: string | null },
    @Ip() ipAddress: string,
  ) {
    const scope = { role: user.role as UserRole, distributionId: user.distributionId ?? null, branchId: user.branchId ?? null };
    return this.shipmentsService.importExcel(id, dto, file, user.id, ipAddress, scope);
  }
}
