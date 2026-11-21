import { Controller, Get, Optional, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import * as path from 'path';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { scopeWhere, toScopeContext } from 'src/common/utils/scope-filter.util';
import {
  StorageInvalidPathError,
  UploadsStorageService,
} from 'src/common/storage/uploads-storage.service';

type AuthenticatedRequest = Request & {
  user?: {
    id: string;
    role: UserRole;
    distributionId?: string | null;
    branchId?: string | null;
    branchModeratorBranchIds?: string[];
  };
};

@Controller('files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  private readonly storage: UploadsStorageService;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    @Optional() storage?: UploadsStorageService,
  ) {
    this.storage = storage ?? new UploadsStorageService(this.config);
  }

  @Get('photo')
  async servePhoto(
    @Query('path') filePath: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    if (!filePath || typeof filePath !== 'string') {
      return res.status(400).send('Missing path');
    }
    const sanitized = filePath.replace(/^\/+/, '').trim();
    if (!sanitized.startsWith('installation-records/')) {
      return res.status(400).send('Invalid path');
    }

    let resolvedPath: string;
    try {
      resolvedPath = this.storage.resolvePath(sanitized);
    } catch (error) {
      if (error instanceof StorageInvalidPathError) {
        return res.status(400).send('Invalid path');
      }
      throw error;
    }

    const user = req.user;
    if (user && user.role !== UserRole.SYSTEM_ADMIN) {
      const scope = toScopeContext(user);
      const scopeClause = scopeWhere(scope, { viaMeter: true });
      const authorizedRecord = await this.prisma.installationRecord.findFirst({
        where: {
          photos: { array_contains: [sanitized] },
          ...(scopeClause ? { AND: [scopeClause] } : {}),
        },
        select: { id: true },
      });
      if (!authorizedRecord) {
        return res.status(403).send('Forbidden');
      }
    }

    if (!this.storage.exists(sanitized)) {
      return res.status(404).send('File not found');
    }
    const ext = path.extname(resolvedPath).toLowerCase();
    const contentType = ext === '.png' ? 'image/png' : 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    const stream = this.storage.createReadStream(sanitized);
    stream.on('error', () => {
      if (!res.headersSent) {
        res.status(404).send('File not found');
      } else {
        res.destroy();
      }
    });
    return stream.pipe(res);
  }
}
