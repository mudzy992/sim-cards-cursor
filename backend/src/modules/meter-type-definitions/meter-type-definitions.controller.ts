import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ParseUUIDPipe } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { MeterTypeDefinitionsService } from './meter-type-definitions.service';
import { CreateMeterTypeDefinitionDto } from './dto/create-meter-type-definition.dto';
import { UpdateMeterTypeDefinitionDto } from './dto/update-meter-type-definition.dto';

@ApiTags('meter-type-definitions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('meter-type-definitions')
export class MeterTypeDefinitionsController {
  constructor(
    private readonly meterTypeDefinitionsService: MeterTypeDefinitionsService,
  ) {}

  @Get('list')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR, UserRole.USER)
  @ApiOperation({ summary: 'Lista tipova brojila (za dropdown)' })
  list() {
    return this.meterTypeDefinitionsService.findAll();
  }

  @Get()
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Lista tipova brojila' })
  findAll() {
    return this.meterTypeDefinitionsService.findAll();
  }

  @Get(':id')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Detalji tipa brojila' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.meterTypeDefinitionsService.findOne(id);
  }

  @Post()
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Kreiraj tip brojila' })
  create(@Body() dto: CreateMeterTypeDefinitionDto) {
    return this.meterTypeDefinitionsService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Ažuriraj tip brojila' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMeterTypeDefinitionDto,
  ) {
    return this.meterTypeDefinitionsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Obriši tip brojila' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.meterTypeDefinitionsService.remove(id);
  }
}
