import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
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
  @Roles('SYSTEM_ADMIN', 'MODERATOR')
  findAll(
    @Query('distributionId') distributionId?: string,
    @CurrentUser() user?: { role: string; distributionId?: string | null },
  ) {
    const effectiveDistributionId = distributionId ?? (user?.role === 'MODERATOR' ? user.distributionId ?? undefined : undefined);
    return this.service.findAll(effectiveDistributionId);
  }

  @Get(':id')
  @Roles('SYSTEM_ADMIN', 'MODERATOR')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
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
