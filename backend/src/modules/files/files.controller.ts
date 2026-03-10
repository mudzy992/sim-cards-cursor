import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@Controller('files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  private readonly uploadsDir = path.join(process.cwd(), 'uploads');

  @Get('photo')
  async servePhoto(@Query('path') filePath: string, @Res() res: Response) {
    if (!filePath || typeof filePath !== 'string') {
      return res.status(400).send('Missing path');
    }
    const sanitized = filePath.replace(/\.\./g, '').replace(/^\/+/, '').trim();
    if (!sanitized.startsWith('installation-records/')) {
      return res.status(400).send('Invalid path');
    }
    const fullPath = path.join(this.uploadsDir, sanitized);
    const resolved = path.resolve(fullPath);
    if (!fs.existsSync(resolved) || !resolved.startsWith(path.resolve(this.uploadsDir))) {
      return res.status(404).send('File not found');
    }
    const ext = path.extname(resolved).toLowerCase();
    const contentType = ext === '.png' ? 'image/png' : 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    const stream = fs.createReadStream(resolved);
    return stream.pipe(res);
  }
}
