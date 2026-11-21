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
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { BranchModeratorGuard } from 'src/common/guards/branch-moderator.guard';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { MeterTypeDefinitionsService } from './meter-type-definitions.service';
import { MeterTypeFieldsService } from './meter-type-fields.service';
import { CreateMeterTypeDefinitionDto } from './dto/create-meter-type-definition.dto';
import { UpdateMeterTypeDefinitionDto } from './dto/update-meter-type-definition.dto';
import { CreateMeterTypeFieldDto } from './dto/create-meter-type-field.dto';
import { UpdateMeterTypeFieldDto } from './dto/update-meter-type-field.dto';
import { ReorderMeterTypeFieldsDto } from './dto/reorder-meter-type-fields.dto';

@ApiTags('meter-type-definitions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('meter-type-definitions')
export class MeterTypeDefinitionsController {
  constructor(
    private readonly meterTypeDefinitionsService: MeterTypeDefinitionsService,
    private readonly meterTypeFieldsService: MeterTypeFieldsService,
  ) {}

  @Get('list')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.DIST_ADMIN, UserRole.USER)
  @ApiOperation({ summary: 'Lista tipova brojila (za dropdown)' })
  list() {
    return this.meterTypeDefinitionsService.findAll();
  }

  @Get()
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.DIST_ADMIN, UserRole.USER)
  @UseGuards(BranchModeratorGuard)
  @ApiOperation({ summary: 'Lista tipova brojila' })
  findAll() {
    return this.meterTypeDefinitionsService.findAll();
  }

  @Get(':id')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.DIST_ADMIN, UserRole.USER)
  @UseGuards(BranchModeratorGuard)
  @ApiOperation({ summary: 'Detalji tipa brojila' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.meterTypeDefinitionsService.findOne(id);
  }

  @Post()
  @Roles(UserRole.SYSTEM_ADMIN)
  @ApiOperation({ summary: 'Kreiraj tip brojila' })
  create(
    @Body() dto: CreateMeterTypeDefinitionDto,
    @CurrentUser('id') actorId?: string,
    @Ip() ipAddress?: string,
  ) {
    return this.meterTypeDefinitionsService.create(dto, actorId, ipAddress);
  }

  @Patch(':id')
  @Roles(UserRole.SYSTEM_ADMIN)
  @ApiOperation({ summary: 'Ažuriraj tip brojila' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMeterTypeDefinitionDto,
    @CurrentUser('id') actorId?: string,
    @Ip() ipAddress?: string,
  ) {
    return this.meterTypeDefinitionsService.update(id, dto, actorId, ipAddress);
  }

  @Delete(':id')
  @Roles(UserRole.SYSTEM_ADMIN)
  @ApiOperation({ summary: 'Obriši tip brojila' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') actorId?: string,
    @Ip() ipAddress?: string,
  ) {
    return this.meterTypeDefinitionsService.remove(id, actorId, ipAddress);
  }

  @Get(':id/fields')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.DIST_ADMIN, UserRole.USER)
  @ApiOperation({ summary: 'Lista polja za tip brojila' })
  findFields(@Param('id', ParseUUIDPipe) id: string) {
    return this.meterTypeFieldsService.findAllByDefinition(id);
  }

  @Post(':id/fields')
  @Roles(UserRole.SYSTEM_ADMIN)
  @ApiOperation({ summary: 'Dodaj polje za tip brojila' })
  createField(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateMeterTypeFieldDto,
    @CurrentUser('id') actorId?: string,
    @Ip() ipAddress?: string,
  ) {
    return this.meterTypeFieldsService.create(id, dto, actorId, ipAddress);
  }

  @Patch(':defId/fields/:fieldId')
  @Roles(UserRole.SYSTEM_ADMIN)
  @ApiOperation({ summary: 'Ažuriraj polje tipa brojila' })
  updateField(
    @Param('defId', ParseUUIDPipe) _defId: string,
    @Param('fieldId', ParseUUIDPipe) fieldId: string,
    @Body() dto: UpdateMeterTypeFieldDto,
    @CurrentUser('id') actorId?: string,
    @Ip() ipAddress?: string,
  ) {
    return this.meterTypeFieldsService.update(fieldId, dto, actorId, ipAddress);
  }

  @Delete(':defId/fields/:fieldId')
  @Roles(UserRole.SYSTEM_ADMIN)
  @ApiOperation({ summary: 'Obriši polje tipa brojila' })
  removeField(
    @Param('defId', ParseUUIDPipe) _defId: string,
    @Param('fieldId', ParseUUIDPipe) fieldId: string,
    @CurrentUser('id') actorId?: string,
    @Ip() ipAddress?: string,
  ) {
    return this.meterTypeFieldsService.remove(fieldId, actorId, ipAddress);
  }

  @Put(':id/fields/reorder')
  @Roles(UserRole.SYSTEM_ADMIN)
  @ApiOperation({ summary: 'Promijeni redoslijed polja tipa brojila' })
  reorderFields(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReorderMeterTypeFieldsDto,
    @CurrentUser('id') actorId?: string,
    @Ip() ipAddress?: string,
  ) {
    return this.meterTypeFieldsService.reorder(id, dto.fieldIds, actorId, ipAddress);
  }
}
