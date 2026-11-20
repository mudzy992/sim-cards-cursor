import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PdfGeneratorService {
  async generatePdf(templateName: string, data: Record<string, unknown>): Promise<Buffer> {
    let templatePath = path.resolve(__dirname, '..', '..', 'templates', `${templateName}.hbs`);
    if (!fs.existsSync(templatePath)) {
      const distPath = path.join(
        process.cwd(),
        'dist',
        'src',
        'templates',
        `${templateName}.hbs`,
      );
      if (fs.existsSync(distPath)) {
        templatePath = distPath;
      } else {
        templatePath = path.join(process.cwd(), 'src', 'templates', `${templateName}.hbs`);
      }
    }
    if (!fs.existsSync(templatePath)) {
      throw new InternalServerErrorException(`PDF template "${templateName}" not found`);
    }

    const templateContent = fs.readFileSync(templatePath, 'utf8');
    const compiledTemplate = handlebars.compile(templateContent);
    const html = compiledTemplate(data);

    const browser = await puppeteer.launch({
      headless: true,
      ...(process.env.PUPPETEER_EXECUTABLE_PATH
        ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH }
        : {}),
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      const pdfBuffer = await page.pdf({ format: 'A4' });
      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  }
}
