
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UseInterceptors, UploadedFile } from '@nestjs/common';
import { Request } from 'express';
import { InstallationRecordsService } from './installation-records.service';
import { PhotoUploadService } from './photo-upload.service';
import { CreateInstallationRecordDto } from './dto/create-installation-record.dto';
import { UpdateInstallationRecordDto } from './dto/update-installation-record.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { InstallationRecord, UserRole } from '@prisma/client';
import { InstallationRecordFilterDto } from './dto/installation-record-filter.dto';
import { PaginatedResult } from 'src/common/interfaces/paginated-result.interface';
import { ApiPaginated } from 'src/common/decorators/api-paginated.decorator';
import { StatusTransitionGuard } from './guards/status-transition.guard';
import { RejectionReasonDto } from './dto/rejection-reason.dto';
import { SendRecordDto } from './dto/send-record.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { User } from '@prisma/client';
import { Response } from 'express';

@ApiTags('Installation Records')
@Controller('installation-records')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class InstallationRecordsController {
  constructor(
    private readonly installationRecordsService: InstallationRecordsService,
    private readonly photoUploadService: PhotoUploadService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new installation record' })
  @ApiResponse({
    status: 201,
    description: 'The installation record has been successfully created.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR, UserRole.USER)
  create(
    @Body() createInstallationRecordDto: CreateInstallationRecordDto,
    @CurrentUser() user?: { id: string; branchId?: string | null },
    @Req() req?: Request,
  ): Promise<InstallationRecord> {
    const ipAddress =
      (req?.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req?.socket?.remoteAddress;
    return this.installationRecordsService.create(
      createInstallationRecordDto,
      { ipAddress, branchId: user?.branchId ?? null },
    );
  }

  @Post('upload-photo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Upload photo for installation record (returns path for photos array)' })
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR, UserRole.USER)
  async uploadPhoto(@UploadedFile() file: Express.Multer.File): Promise<{ path: string }> {
    const path = await this.photoUploadService.save(file);
    return { path };
  }

  @Get()
  @ApiPaginated()
  @ApiOperation({ summary: 'Get all installation records' })
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR, UserRole.USER)
  findAll(
    @Query() filter: InstallationRecordFilterDto,
    @CurrentUser() user?: { id: string; role: string; distributionId?: string | null; branchId?: string | null },
  ): Promise<PaginatedResult<InstallationRecord>> {
    const scope = user ? { role: user.role as UserRole, distributionId: user.distributionId ?? null, branchId: user.branchId ?? null } : null;
    if (user?.role === UserRole.USER) {
      return this.installationRecordsService.findAllForUser(user.id, filter, scope);
    }
    return this.installationRecordsService.findAll(filter, scope);
  }

  @Get('my')
  @ApiPaginated()
  @ApiOperation({ summary: 'Get current user installation records' })
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR, UserRole.USER)
  findMy(
    @CurrentUser() user: { id: string; role: string; distributionId?: string | null; branchId?: string | null },
    @Query() filter: InstallationRecordFilterDto,
  ): Promise<PaginatedResult<InstallationRecord>> {
    const scope = { role: user.role as UserRole, distributionId: user.distributionId ?? null, branchId: user.branchId ?? null };
    return this.installationRecordsService.findAllByInstaller(user.id, filter, scope);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an installation record by ID' })
  @ApiResponse({ status: 200, description: 'Return the installation record.' })
  @ApiResponse({ status: 404, description: 'Installation record not found.' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user?: { role: string; distributionId?: string | null; branchId?: string | null }): Promise<InstallationRecord> {
    const scope = user ? { role: user.role as UserRole, distributionId: user.distributionId ?? null, branchId: user.branchId ?? null } : null;
    return this.installationRecordsService.findOne(id, scope);
  }

  @Get(':id/timeline')
  @ApiOperation({ summary: 'Timeline događaja za dati zapisnik (ActivityLog feed)' })
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR, UserRole.USER)
  getTimeline(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { role: string; distributionId?: string | null; branchId?: string | null },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const scope = {
      role: user.role as UserRole,
      distributionId: user.distributionId ?? null,
      branchId: user.branchId ?? null,
    };
    const pageNum = page ? parseInt(page, 10) || 1 : 1;
    const limitNum = limit ? parseInt(limit, 10) || 20 : 20;
    return this.installationRecordsService.getTimeline(id, scope, pageNum, limitNum);
  }

  @Get(':id/permissions')
  @ApiOperation({ summary: 'Permissions for current user on installation record actions' })
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR, UserRole.USER)
  getPermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string; role: string; distributionId?: string | null; branchId?: string | null },
  ) {
    const scope = { role: user.role as UserRole, distributionId: user.distributionId ?? null, branchId: user.branchId ?? null };
    return this.installationRecordsService.getPermissions(id, user.id, scope);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Download an installation record as a PDF' })
  @ApiResponse({ status: 200, description: 'Return the PDF file.' })
  @ApiResponse({ status: 404, description: 'Installation record not found.' })
  async downloadPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
    @CurrentUser() user?: { role: string; distributionId?: string | null; branchId?: string | null },
  ) {
    const scope = user ? { role: user.role as UserRole, distributionId: user.distributionId ?? null, branchId: user.branchId ?? null } : null;
    const pdfBuffer = await this.installationRecordsService.generatePdf(id, scope);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=record-${id}.pdf`,
      'Content-Length': pdfBuffer.length,
    });
    res.end(pdfBuffer);
  }

  @Patch(':id')
  @UseGuards(StatusTransitionGuard)
  @ApiOperation({ summary: 'Update an installation record' })
  @ApiResponse({
    status: 200,
    description: 'The installation record has been successfully updated.',
  })
  @ApiResponse({ status: 404, description: 'Installation record not found.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateInstallationRecordDto: UpdateInstallationRecordDto,
    @CurrentUser() user: User,
    @Req() req: Request,
  ): Promise<InstallationRecord> {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress;
    return this.installationRecordsService.update(
      id,
      updateInstallationRecordDto,
      { userId: user.id, ipAddress },
    );
  }

  @Delete(':id')
  @Roles(UserRole.SYSTEM_ADMIN)
  @ApiOperation({ summary: 'Delete an installation record' })
  @ApiResponse({
    status: 200,
    description: 'The installation record has been successfully deleted.',
  })
  @ApiResponse({ status: 404, description: 'Installation record not found.' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Req() req: Request,
  ): Promise<InstallationRecord> {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress;
    return this.installationRecordsService.remove(id, {
      userId: user.id,
      ipAddress,
    });
  }

  @Post(':id/approve')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR, UserRole.USER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve an installation record' })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User & { distributionId?: string | null; branchId?: string | null },
  ): Promise<InstallationRecord> {
    const scope = { role: user.role, distributionId: user.distributionId ?? null, branchId: user.branchId ?? null };
    return this.installationRecordsService.approve(id, user.id, scope);
  }

  @Post(':id/submit-for-approval')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR, UserRole.USER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pošalji zapisnik grupi na odobrenje (tekstualni email)' })
  submitForApproval(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User & { distributionId?: string | null; branchId?: string | null },
    @Req() req: Request,
  ): Promise<InstallationRecord> {
    const scope = { role: user.role, distributionId: user.distributionId ?? null, branchId: user.branchId ?? null };
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress;
    return this.installationRecordsService.submitForApproval(
      id,
      { userId: user.id, ipAddress },
      scope,
    );
  }

  @Post(':id/activate-sep')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR, UserRole.USER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Označi zapisnik kao aktiviran u SEP' })
  activateInSep(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User & { distributionId?: string | null; branchId?: string | null },
    @Req() req: Request,
  ): Promise<InstallationRecord> {
    const scope = { role: user.role, distributionId: user.distributionId ?? null, branchId: user.branchId ?? null };
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress;
    return this.installationRecordsService.activateInSep(
      id,
      { userId: user.id, ipAddress },
      scope,
    );
  }

  @Post(':id/send')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send approved record via email with PDF attachment' })
  send(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendRecordDto,
    @CurrentUser() user: User & { distributionId?: string | null; branchId?: string | null },
    @Req() req: Request,
  ): Promise<InstallationRecord> {
    const scope = { role: user.role, distributionId: user.distributionId ?? null, branchId: user.branchId ?? null };
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress;
    return this.installationRecordsService.sendRecord(
      id,
      dto.recipientGroupIds,
      dto.manualEmails,
      { userId: user.id, ipAddress },
      scope,
    );
  }

  @Post(':id/reject')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR, UserRole.USER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject an installation record' })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() rejectionReasonDto: RejectionReasonDto,
    @CurrentUser() user: User & { distributionId?: string | null; branchId?: string | null },
    @Req() req: Request,
  ): Promise<InstallationRecord> {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress;
    const scope = { role: user.role, distributionId: user.distributionId ?? null, branchId: user.branchId ?? null };
    return this.installationRecordsService.reject(id, rejectionReasonDto, {
      userId: user.id,
      ipAddress,
    }, scope);
  }
}
