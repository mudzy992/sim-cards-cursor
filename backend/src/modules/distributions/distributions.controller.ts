import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
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
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.DIST_ADMIN)
  findAll(@CurrentUser() user: { role: UserRole; distributionId?: string | null }) {
    if (user.role === UserRole.DIST_ADMIN) {
      if (!user.distributionId) {
        return [];
      }
      return this.service.findAll(user.distributionId);
    }
    return this.service.findAll(undefined);
  }

  @Get(':id')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.DIST_ADMIN)
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: { role: UserRole; distributionId?: string | null },
  ) {
    if (
      user.role === UserRole.DIST_ADMIN &&
      (!user.distributionId || id !== user.distributionId)
    ) {
      throw new ForbiddenException('Distribution is outside your scope');
    }
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
