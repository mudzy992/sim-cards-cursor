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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiPaginated } from '../../common/decorators/api-paginated.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AssignSimCardDto } from './dto/assign-sim-card.dto';
import { CreateSimCardDto } from './dto/create-sim-card.dto';
import { SimCardFilterDto } from './dto/sim-card-filter.dto';
import { UpdateSimCardDto } from './dto/update-sim-card.dto';
import { SimCardsService } from './sim-cards.service';

@ApiTags('sim-cards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sim-cards')
export class SimCardsController {
  constructor(private readonly simCardsService: SimCardsService) {}

  @Get()
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR)
  @ApiPaginated('Lista SIM kartica')
  findAll(@Query() filter: SimCardFilterDto, @CurrentUser() user?: { role: string; distributionId?: string | null; branchId?: string | null }) {
    const scope = user ? { role: user.role as UserRole, distributionId: user.distributionId ?? null, branchId: user.branchId ?? null } : null;
    return this.simCardsService.findAll(filter, scope);
  }

  @Get('my-assigned')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR, UserRole.USER)
  @ApiPaginated('Moje dodijeljene SIM kartice')
  myAssigned(@CurrentUser() user: { id: string; role: string; distributionId?: string | null; branchId?: string | null }, @Query() filter: SimCardFilterDto) {
    const scope = { role: user.role as UserRole, distributionId: user.distributionId ?? null, branchId: user.branchId ?? null };
    return this.simCardsService.myAssigned(user.id, filter, scope);
  }

  @Get('available')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR)
  @ApiPaginated('Dostupne SIM kartice')
  available(@Query() filter: SimCardFilterDto, @CurrentUser() user?: { role: string; distributionId?: string | null; branchId?: string | null }) {
    const scope = user ? { role: user.role as UserRole, distributionId: user.distributionId ?? null, branchId: user.branchId ?? null } : null;
    return this.simCardsService.available(filter, scope);
  }

  @Get('stats')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Statistike po statusu SIM kartica' })
  stats(@CurrentUser() user?: { role: string; distributionId?: string | null; branchId?: string | null }) {
    const scope = user ? { role: user.role as UserRole, distributionId: user.distributionId ?? null, branchId: user.branchId ?? null } : null;
    return this.simCardsService.stats(scope);
  }

  @Get('scan/:iccid')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR, UserRole.USER)
  @ApiOperation({ summary: 'Skeniranje SIM kartice po ICCID' })
  @Throttle(30, 60_000)
  scan(
    @Param('iccid') iccid: string,
    @CurrentUser() user?: { role: string; distributionId?: string | null; branchId?: string | null },
  ) {
    const scope = user ? { role: user.role as UserRole, distributionId: user.distributionId ?? null, branchId: user.branchId ?? null } : null;
    return this.simCardsService.scanByIccid(iccid, scope);
  }

  @Get(':id')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Detalji SIM kartice' })
  findOne(@Param('id') id: string, @CurrentUser() user?: { role: string; distributionId?: string | null; branchId?: string | null }) {
    const scope = user ? { role: user.role as UserRole, distributionId: user.distributionId ?? null, branchId: user.branchId ?? null } : null;
    return this.simCardsService.findOne(id, scope);
  }

  @Post()
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Kreiranje SIM kartice' })
  create(
    @Body() dto: CreateSimCardDto,
    @CurrentUser() user: { id: string; role: string; distributionId?: string | null; branchId?: string | null },
    @Ip() ipAddress: string,
  ) {
    const scope = { role: user.role as UserRole, distributionId: user.distributionId ?? null, branchId: user.branchId ?? null };
    return this.simCardsService.create(dto, user.id, ipAddress, scope);
  }

  @Patch(':id')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Ažuriranje SIM kartice' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSimCardDto,
    @CurrentUser() user: { id: string; role: string; distributionId?: string | null; branchId?: string | null },
    @Ip() ipAddress: string,
  ) {
    const scope = { role: user.role as UserRole, distributionId: user.distributionId ?? null, branchId: user.branchId ?? null };
    return this.simCardsService.update(id, dto, user.id, ipAddress, scope);
  }

  @Delete(':id')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Brisanje SIM kartice' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string; distributionId?: string | null; branchId?: string | null },
    @Ip() ipAddress: string,
  ) {
    const scope = { role: user.role as UserRole, distributionId: user.distributionId ?? null, branchId: user.branchId ?? null };
    return this.simCardsService.remove(id, user.id, ipAddress, scope);
  }

  @Post(':id/assign')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Dodjela SIM kartice korisniku' })
  assign(
    @Param('id') id: string,
    @Body() dto: AssignSimCardDto,
    @CurrentUser() user: { id: string; role: string; distributionId?: string | null; branchId?: string | null },
    @Ip() ipAddress: string,
  ) {
    const scope = { role: user.role as UserRole, distributionId: user.distributionId ?? null, branchId: user.branchId ?? null };
    return this.simCardsService.assign(id, dto, user.id, ipAddress, scope);
  }

  @Post(':id/claim')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR, UserRole.USER)
  @ApiOperation({ summary: 'Zaduživanje SIM kartice od strane prijavljenog korisnika' })
  claim(@Param('id') id: string, @CurrentUser() user: { id: string; role: string; distributionId?: string | null; branchId?: string | null }, @Ip() ipAddress: string) {
    const scope = { role: user.role as UserRole, distributionId: user.distributionId ?? null, branchId: user.branchId ?? null };
    return this.simCardsService.claim(id, user.id, ipAddress, scope);
  }

  @Post(':id/unassign')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Oduzimanje dodijeljene SIM kartice' })
  unassign(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string; distributionId?: string | null; branchId?: string | null },
    @Ip() ipAddress: string,
  ) {
    const scope = { role: user.role as UserRole, distributionId: user.distributionId ?? null, branchId: user.branchId ?? null };
    return this.simCardsService.unassign(id, user.id, ipAddress, scope);
  }
}
