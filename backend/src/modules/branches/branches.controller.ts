import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Controller('branches')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BranchesController {
  constructor(private readonly service: BranchesService) {}

  @Post()
  @Roles('SYSTEM_ADMIN')
  create(@Body() dto: CreateBranchDto) {
    return this.service.create(dto);
  }

  @Get()
  @Roles('SYSTEM_ADMIN', 'DIST_ADMIN')
  findAll(
    @Query('distributionId') distributionId: string | undefined,
    @CurrentUser() user: { role: UserRole; distributionId?: string | null },
  ) {
    if (user.role === UserRole.DIST_ADMIN) {
      if (!user.distributionId) {
        return [];
      }
      if (distributionId && distributionId !== user.distributionId) {
        throw new ForbiddenException('Distribution is outside your scope');
      }
      return this.service.findAll(user.distributionId);
    }
    return this.service.findAll(distributionId);
  }

  @Get(':id')
  @Roles('SYSTEM_ADMIN', 'DIST_ADMIN')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: { role: UserRole; distributionId?: string | null },
  ) {
    const branch = await this.service.findOne(id);
    if (
      user.role === UserRole.DIST_ADMIN &&
      (!user.distributionId || branch.distributionId !== user.distributionId)
    ) {
      throw new ForbiddenException('Branch is outside your distribution scope');
    }
    return branch;
  }

  @Patch(':id')
  @Roles('SYSTEM_ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateBranchDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles('SYSTEM_ADMIN')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
