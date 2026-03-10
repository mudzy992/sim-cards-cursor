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
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { DistributionsService } from './distributions.service';
import { CreateDistributionDto } from './dto/create-distribution.dto';
import { UpdateDistributionDto } from './dto/update-distribution.dto';

@Controller('distributions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DistributionsController {
  constructor(private readonly service: DistributionsService) {}

  @Post()
  @Roles(UserRole.SYSTEM_ADMIN)
  create(@Body() dto: CreateDistributionDto) {
    return this.service.create(dto);
  }

  @Get()
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR)
  findAll(@CurrentUser() user?: { role: string; distributionId?: string | null }) {
    return this.service.findAll(user?.role === 'MODERATOR' ? user.distributionId ?? undefined : undefined);
  }

  @Get(':id')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.SYSTEM_ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateDistributionDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SYSTEM_ADMIN)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
