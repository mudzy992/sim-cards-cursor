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
import { BranchModeratorGuard } from '../../common/guards/branch-moderator.guard';
import { toScopeContext } from '../../common/utils/scope-filter.util';
import { AssignSimCardDto } from './dto/assign-sim-card.dto';
import { BulkAssignSimCardsDto } from './dto/bulk-assign-sim-cards.dto';
import { CreateSimCardDto } from './dto/create-sim-card.dto';
import { ScanBatchDto } from './dto/scan-batch.dto';
import { SimCardFilterDto } from './dto/sim-card-filter.dto';
import { UpdateSimCardDto } from './dto/update-sim-card.dto';
import { SimCardsService } from './sim-cards.service';

type RequestUser = {
  id: string;
  role: string;
  distributionId?: string | null;
  branchId?: string | null;
  branchModeratorBranchIds?: string[];
};

@ApiTags('sim-cards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sim-cards')
export class SimCardsController {
  constructor(private readonly simCardsService: SimCardsService) {}

  @Get()
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.DIST_ADMIN)
  @ApiPaginated('Lista SIM kartica')
  findAll(@Query() filter: SimCardFilterDto, @CurrentUser() user?: RequestUser) {
    const scope = toScopeContext(user ? { ...user, role: user.role as UserRole } : null);
    return this.simCardsService.findAll(filter, scope);
  }

  @Get('moderated-installed')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.DIST_ADMIN, UserRole.USER)
  @UseGuards(BranchModeratorGuard)
  @ApiPaginated('SIM kartice ugrađene u moderirane podružnice')
  moderatedInstalled(@Query() filter: SimCardFilterDto, @CurrentUser() user?: RequestUser) {
    const scope = toScopeContext(user ? { ...user, role: user.role as UserRole } : null);
    return this.simCardsService.moderatedInstalled(filter, scope);
  }

  @Get('my-assigned')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.DIST_ADMIN, UserRole.USER)
  @ApiPaginated('Moje dodijeljene SIM kartice')
  myAssigned(@CurrentUser() user: RequestUser, @Query() filter: SimCardFilterDto) {
    const scope = toScopeContext({ ...user, role: user.role as UserRole });
    return this.simCardsService.myAssigned(user.id, filter, scope);
  }

  @Get('available')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.DIST_ADMIN)
  @ApiPaginated('Dostupne SIM kartice')
  available(@Query() filter: SimCardFilterDto, @CurrentUser() user?: RequestUser) {
    const scope = toScopeContext(user ? { ...user, role: user.role as UserRole } : null);
    return this.simCardsService.available(filter, scope);
  }

  @Get('stats')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.DIST_ADMIN)
  @ApiOperation({ summary: 'Statistike po statusu SIM kartica' })
  stats(@CurrentUser() user?: RequestUser) {
    const scope = toScopeContext(user ? { ...user, role: user.role as UserRole } : null);
    return this.simCardsService.stats(scope);
  }

  @Post('scan-batch')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.DIST_ADMIN, UserRole.USER)
  @ApiOperation({ summary: 'Batch skeniranje SIM kartica po listi ICCID-ova (offline sync)' })
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  scanBatch(@Body() dto: ScanBatchDto, @CurrentUser() user?: RequestUser) {
    const scope = toScopeContext(user ? { ...user, role: user.role as UserRole } : null);
    return this.simCardsService.scanBatch(dto.iccids, scope);
  }

  @Post('bulk-assign')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.DIST_ADMIN)
  @ApiOperation({ summary: 'Masovna dodjela dostupnih SIM kartica korisniku' })
  bulkAssign(
    @Body() dto: BulkAssignSimCardsDto,
    @CurrentUser() user: RequestUser,
    @Ip() ipAddress: string,
  ) {
    const scope = toScopeContext({ ...user, role: user.role as UserRole });
    return this.simCardsService.bulkAssign(dto.simCardIds, dto.userId, user.id, ipAddress, scope);
  }

  @Get('scan/:iccid')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.DIST_ADMIN, UserRole.USER)
  @ApiOperation({ summary: 'Skeniranje SIM kartice po ICCID' })
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  scan(@Param('iccid') iccid: string, @CurrentUser() user?: RequestUser) {
    const scope = toScopeContext(user ? { ...user, role: user.role as UserRole } : null);
    return this.simCardsService.scanByIccid(iccid, scope);
  }

  @Get(':id/events')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.DIST_ADMIN, UserRole.USER)
  @UseGuards(BranchModeratorGuard)
  @ApiOperation({ summary: 'Historija događaja (timeline) za SIM karticu' })
  listEvents(@Param('id') id: string, @CurrentUser() user?: RequestUser) {
    const scope = toScopeContext(user ? { ...user, role: user.role as UserRole } : null);
    return this.simCardsService.listEvents(id, scope, user?.id);
  }

  @Get(':id')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.DIST_ADMIN, UserRole.USER)
  @UseGuards(BranchModeratorGuard)
  @ApiOperation({ summary: 'Detalji SIM kartice' })
  findOne(@Param('id') id: string, @CurrentUser() user?: RequestUser) {
    const scope = toScopeContext(user ? { ...user, role: user.role as UserRole } : null);
    return this.simCardsService.findOne(id, scope, user?.id);
  }

  @Post()
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.DIST_ADMIN)
  @ApiOperation({ summary: 'Kreiranje SIM kartice' })
  create(
    @Body() dto: CreateSimCardDto,
    @CurrentUser() user: RequestUser,
    @Ip() ipAddress: string,
  ) {
    const scope = toScopeContext({ ...user, role: user.role as UserRole });
    return this.simCardsService.create(dto, user.id, ipAddress, scope);
  }

  @Patch(':id')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.DIST_ADMIN)
  @ApiOperation({ summary: 'Ažuriranje SIM kartice' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSimCardDto,
    @CurrentUser() user: RequestUser,
    @Ip() ipAddress: string,
  ) {
    const scope = toScopeContext({ ...user, role: user.role as UserRole });
    return this.simCardsService.update(id, dto, user.id, ipAddress, scope);
  }

  @Delete(':id')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.DIST_ADMIN)
  @ApiOperation({ summary: 'Brisanje SIM kartice' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Ip() ipAddress: string,
  ) {
    const scope = toScopeContext({ ...user, role: user.role as UserRole });
    return this.simCardsService.remove(id, user.id, ipAddress, scope);
  }

  @Post(':id/assign')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.DIST_ADMIN)
  @ApiOperation({ summary: 'Dodjela SIM kartice korisniku' })
  assign(
    @Param('id') id: string,
    @Body() dto: AssignSimCardDto,
    @CurrentUser() user: RequestUser,
    @Ip() ipAddress: string,
  ) {
    const scope = toScopeContext({ ...user, role: user.role as UserRole });
    return this.simCardsService.assign(id, dto, user.id, ipAddress, scope);
  }

  @Post(':id/claim')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.DIST_ADMIN, UserRole.USER)
  @ApiOperation({ summary: 'Zaduživanje SIM kartice od strane prijavljenog korisnika' })
  claim(@Param('id') id: string, @CurrentUser() user: RequestUser, @Ip() ipAddress: string) {
    const scope = toScopeContext({ ...user, role: user.role as UserRole });
    return this.simCardsService.claim(id, user.id, ipAddress, scope);
  }

  @Post(':id/unassign')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.DIST_ADMIN)
  @ApiOperation({ summary: 'Oduzimanje dodijeljene SIM kartice' })
  unassign(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Ip() ipAddress: string,
  ) {
    const scope = toScopeContext({ ...user, role: user.role as UserRole });
    return this.simCardsService.unassign(id, user.id, ipAddress, scope);
  }

  @Post(':id/return-to-stock')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.DIST_ADMIN)
  @ApiOperation({ summary: 'Vraćanje demontirane/vraćene SIM kartice u dostupne zalihe' })
  returnToStock(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Ip() ipAddress: string,
  ) {
    const scope = toScopeContext({ ...user, role: user.role as UserRole });
    return this.simCardsService.returnToStock(id, user.id, ipAddress, scope);
  }
}
