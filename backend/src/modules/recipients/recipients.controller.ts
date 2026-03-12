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
import { ParseUUIDPipe } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { CreateRecipientGroupDto } from './dto/create-recipient-group.dto';
import { CreateBranchApprovalGroupDto } from './dto/branch-approval-group.dto';
import { UpdateRecipientGroupDto } from './dto/update-recipient-group.dto';
import { CreateRecipientDto } from './dto/create-recipient.dto';
import { UpdateRecipientDto } from './dto/update-recipient.dto';
import { AddUserToGroupDto } from './dto/add-user-to-group.dto';
import { UpdateGroupUserPermissionsDto } from './dto/update-group-user-permissions.dto';
import { RecipientsService } from './recipients.service';

@ApiTags('recipients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('recipients')
export class RecipientsController {
  constructor(private readonly recipientsService: RecipientsService) {}

  @Get('users-for-picker')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Korisnici za padajući meni (dodavanje u grupe)' })
  getUsersForPicker(
    @CurrentUser() user?: { role: string; distributionId?: string | null; branchId?: string | null },
  ) {
    return this.recipientsService.getUsersForPicker(
      user?.role === 'MODERATOR' ? user.distributionId ?? undefined : undefined,
    );
  }

  @Get('groups')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Lista grupa primalaca' })
  findAllGroups(
    @CurrentUser() user?: { role: string; distributionId?: string | null },
  ) {
    const distributionId =
      user?.role === 'MODERATOR' ? user.distributionId ?? undefined : undefined;
    return this.recipientsService.findAllGroups(distributionId);
  }

  @Get('groups/:id')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Detalji grupe primalaca' })
  findGroupById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user?: { role: string; distributionId?: string | null },
  ) {
    return this.recipientsService.findGroupById(id, {
      role: user?.role as UserRole,
      distributionId: user?.distributionId ?? null,
    });
  }

  @Post('groups')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Kreiranje grupe primalaca' })
  createGroup(
    @Body() dto: CreateRecipientGroupDto,
    @CurrentUser() user?: { role: string; distributionId?: string | null },
  ) {
    const distributionId =
      user?.role === 'MODERATOR' ? user.distributionId ?? dto.distributionId : dto.distributionId;
    return this.recipientsService.createGroup({ ...dto, distributionId });
  }

  @Patch('groups/:id')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Ažuriranje grupe primalaca' })
  updateGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRecipientGroupDto,
    @CurrentUser() user?: { role: string; distributionId?: string | null },
  ) {
    return this.recipientsService.updateGroup(id, dto, {
      role: user?.role as UserRole,
      distributionId: user?.distributionId ?? null,
    });
  }

  @Delete('groups/:id')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Brisanje grupe primalaca' })
  removeGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user?: { role: string; distributionId?: string | null },
  ) {
    return this.recipientsService.removeGroup(id, {
      role: user?.role as UserRole,
      distributionId: user?.distributionId ?? null,
    });
  }

  @Post('groups/:id/users')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Dodaj korisnika aplikacije u grupu (notifikacije + email)' })
  addUserToGroup(
    @Param('id', ParseUUIDPipe) recipientGroupId: string,
    @Body() dto: AddUserToGroupDto,
    @CurrentUser() user?: { role: string; distributionId?: string | null },
  ) {
    return this.recipientsService.addUserToGroup(recipientGroupId, dto.userId, {
      role: user?.role as UserRole,
      distributionId: user?.distributionId ?? null,
    });
  }

  @Delete('groups/:id/users/:userId')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Ukloni korisnika iz grupe' })
  removeUserFromGroup(
    @Param('id', ParseUUIDPipe) recipientGroupId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user?: { role: string; distributionId?: string | null },
  ) {
    return this.recipientsService.removeUserFromGroup(recipientGroupId, userId, {
      role: user?.role as UserRole,
      distributionId: user?.distributionId ?? null,
    });
  }

  @Patch('groups/:id/users/:userId/permissions')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Ažuriranje granularnih permisija korisnika u APPROVAL grupi' })
  updateGroupUserPermissions(
    @Param('id', ParseUUIDPipe) recipientGroupId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateGroupUserPermissionsDto,
    @CurrentUser() user?: { role: string; distributionId?: string | null },
  ) {
    return this.recipientsService.updateGroupUserPermissions(
      recipientGroupId,
      userId,
      dto,
      {
        role: user?.role as UserRole,
        distributionId: user?.distributionId ?? null,
      },
    );
  }

  @Get('groups/:id/users')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Lista korisnika aplikacije u grupi' })
  getGroupUsers(
    @Param('id', ParseUUIDPipe) recipientGroupId: string,
    @CurrentUser() user?: { role: string; distributionId?: string | null },
  ) {
    return this.recipientsService.getGroupUsers(recipientGroupId, {
      role: user?.role as UserRole,
      distributionId: user?.distributionId ?? null,
    });
  }

  @Post()
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Kreiranje primaoca' })
  createRecipient(
    @Body() dto: CreateRecipientDto,
    @CurrentUser() user?: { role: string; distributionId?: string | null },
  ) {
    return this.recipientsService.createRecipient(dto, {
      role: user?.role as UserRole,
      distributionId: user?.distributionId ?? null,
    });
  }

  @Patch(':id')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Ažuriranje primaoca' })
  updateRecipient(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRecipientDto,
    @CurrentUser() user?: { role: string; distributionId?: string | null },
  ) {
    return this.recipientsService.updateRecipient(id, dto, {
      role: user?.role as UserRole,
      distributionId: user?.distributionId ?? null,
    });
  }

  @Delete(':id')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Brisanje primaoca' })
  removeRecipient(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user?: { role: string; distributionId?: string | null },
  ) {
    return this.recipientsService.removeRecipient(id, {
      role: user?.role as UserRole,
      distributionId: user?.distributionId ?? null,
    });
  }

  @Get('branch-approval-mappings')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Mapiranje podružnica na grupe za odobrenje' })
  getBranchApprovalMappings(
    @Query('distributionId') distributionId?: string,
    @CurrentUser() user?: { role: string; distributionId?: string | null },
  ) {
    const effectiveDistributionId =
      user?.role === 'MODERATOR'
        ? distributionId ?? user.distributionId ?? undefined
        : distributionId;
    return this.recipientsService.getBranchApprovalMappings(effectiveDistributionId);
  }

  @Post('branch-approval-mappings')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Postavi grupu za odobrenje za podružnicu' })
  setBranchApprovalGroup(
    @Body() dto: CreateBranchApprovalGroupDto,
    @CurrentUser() user?: { role: string; distributionId?: string | null },
  ) {
    return this.recipientsService.setBranchApprovalGroup(
      dto.branchId,
      dto.recipientGroupId,
      {
        role: user?.role as UserRole,
        distributionId: user?.distributionId ?? null,
      },
    );
  }

  @Delete('branch-approval-mappings/:branchId')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: 'Ukloni mapiranje podružnice' })
  removeBranchApprovalGroup(
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @CurrentUser() user?: { role: string; distributionId?: string | null },
  ) {
    return this.recipientsService.removeBranchApprovalGroup(branchId, {
      role: user?.role as UserRole,
      distributionId: user?.distributionId ?? null,
    });
  }
}
