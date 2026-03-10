
import { Injectable } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PdfGeneratorService {
  async generatePdf(templateName: string, data: any): Promise<Buffer> {
    let templatePath = path.resolve(__dirname, '..', '..', 'templates', `${templateName}.hbs`);
    if (!fs.existsSync(templatePath)) {
      templatePath = path.join(process.cwd(), 'src', 'templates', `${templateName}.hbs`);
    }
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    const compiledTemplate = handlebars.compile(templateContent);
    const html = compiledTemplate(data);

    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4' });

    await browser.close();

    return Buffer.from(pdfBuffer);
  }
}
