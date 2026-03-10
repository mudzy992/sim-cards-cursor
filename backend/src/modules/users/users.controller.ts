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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiPaginated } from '../../common/decorators/api-paginated.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserFilterDto } from './dto/user-filter.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR)
  @ApiPaginated('Lista korisnika')
  findAll(@Query() filter: UserFilterDto, @CurrentUser() user: { role: string; distributionId?: string | null; branchId?: string | null }) {
    const scope = { role: user.role as UserRole, distributionId: user.distributionId ?? null, branchId: user.branchId ?? null };
    return this.usersService.findAll(filter, scope);
  }

  @Get(':id')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Detalji korisnika' })
  findOne(@Param('id') id: string, @CurrentUser() user: { role: string; distributionId?: string | null; branchId?: string | null }) {
    const scope = { role: user.role as UserRole, distributionId: user.distributionId ?? null, branchId: user.branchId ?? null };
    return this.usersService.findOne(id, scope);
  }

  @Post()
  @Roles(UserRole.SYSTEM_ADMIN)
  @ApiOperation({ summary: 'Kreiranje korisnika' })
  create(@Body() dto: CreateUserDto, @CurrentUser('id') actorId: string) {
    return this.usersService.create(dto, actorId);
  }

  @Patch(':id')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Ažuriranje korisnika' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: { id: string; role: string; distributionId?: string | null; branchId?: string | null },
  ) {
    const scope = { role: user.role as UserRole, distributionId: user.distributionId ?? null, branchId: user.branchId ?? null };
    return this.usersService.update(id, dto, user.id, scope);
  }

  @Delete(':id')
  @Roles(UserRole.SYSTEM_ADMIN)
  @ApiOperation({ summary: 'Brisanje korisnika' })
  remove(@Param('id') id: string, @CurrentUser('id') actorId: string) {
    return this.usersService.remove(id, actorId);
  }

  @Patch(':id/status')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Promjena statusa korisnika' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() user: { id: string; role: string; distributionId?: string | null; branchId?: string | null },
  ) {
    const scope = { role: user.role as UserRole, distributionId: user.distributionId ?? null, branchId: user.branchId ?? null };
    return this.usersService.updateStatus(id, dto.status, user.id, scope);
  }
}
