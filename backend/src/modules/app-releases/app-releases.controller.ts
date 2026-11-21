import {
  Controller,
  Get,
  Param,
  Post,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { UploadAndroidReleaseDto } from './dto/upload-android-release.dto';
import { AppReleasesService } from './app-releases.service';

const apkTempDir = path.join(os.tmpdir(), 'sim-tracker-apk-uploads');

@ApiTags('app-releases')
@Controller('app-releases')
export class AppReleasesController {
  constructor(private readonly service: AppReleasesService) {}

  @Post('android')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SYSTEM_ADMIN)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          fs.mkdirSync(apkTempDir, { recursive: true });
          cb(null, apkTempDir);
        },
        filename: (_req, file, cb) => {
          const safe = (file.originalname ?? 'release.apk').replace(/[^\w.-]+/g, '_');
          cb(null, `${randomUUID()}_${safe}`);
        },
      }),
      limits: { fileSize: 250 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Upload Android APK release (SYSTEM_ADMIN)' })
  uploadAndroid(
    @CurrentUser() user: { id: string },
    @Body() dto: UploadAndroidReleaseDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.service.uploadAndroidRelease({
      actorId: user.id,
      versionName: dto.versionName,
      versionCode: dto.versionCode,
      releaseNotes: dto.releaseNotes,
      file,
    });
  }

  @Get('android')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SYSTEM_ADMIN)
  @ApiOperation({ summary: 'Lista svih Android release-ova' })
  listAndroid() {
    return this.service.listAndroidReleases();
  }

  @Get('android/latest')
  @ApiOperation({ summary: 'Get latest Android release metadata (public)' })
  getLatestAndroid() {
    return this.service.getLatestAndroidRelease();
  }

  @Get('android/download/:id')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Download Android APK (public)' })
  async downloadAndroid(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const { release, stream, contentLength } = await this.service.getAndroidApkStream(id);

    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="sim-tracker-${release.versionName}.apk"`,
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    if (typeof contentLength === 'number') {
      res.setHeader('Content-Length', String(contentLength));
    }
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
