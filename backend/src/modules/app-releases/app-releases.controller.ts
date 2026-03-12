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
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { UploadAndroidReleaseDto } from './dto/upload-android-release.dto';
import { AppReleasesService } from './app-releases.service';
import { ParseUUIDPipe } from '@nestjs/common';

@ApiTags('app-releases')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('app-releases')
export class AppReleasesController {
  constructor(private readonly service: AppReleasesService) {}

  @Post('android')
  @Roles(UserRole.SYSTEM_ADMIN)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 250 * 1024 * 1024 }, // 250MB
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
  @Roles(UserRole.SYSTEM_ADMIN)
  @ApiOperation({ summary: 'Lista svih Android release-ova' })
  listAndroid() {
    return this.service.listAndroidReleases();
  }

  @Get('android/latest')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR, UserRole.USER)
  @ApiOperation({ summary: 'Get latest Android release metadata (auth required)' })
  getLatestAndroid() {
    return this.service.getLatestAndroidRelease();
  }

  @Get('android/download/:id')
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.MODERATOR, UserRole.USER)
  @ApiOperation({ summary: 'Download Android APK (auth required)' })
  async downloadAndroid(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const { release, stream } = await this.service.getAndroidApkStream(id);

    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="sim-tracker-${release.versionName}.apk"`,
    );
    return stream.pipe(res);
  }
}

