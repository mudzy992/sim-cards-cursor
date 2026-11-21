import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

const DEFAULT_MAX_CONCURRENT_PAGES = 2;

@Injectable()
export class PdfGeneratorService implements OnModuleDestroy {
  private readonly logger = new Logger(PdfGeneratorService.name);
  private readonly templateCache = new Map<string, handlebars.TemplateDelegate>();
  private readonly maxConcurrentPages: number;
  private activePages = 0;
  private readonly waitQueue: Array<() => void> = [];
  private browser: puppeteer.Browser | null = null;
  private browserLaunchPromise: Promise<puppeteer.Browser> | null = null;

  constructor() {
    const rawMax = Number(process.env.PDF_MAX_CONCURRENCY ?? DEFAULT_MAX_CONCURRENT_PAGES);
    this.maxConcurrentPages =
      Number.isFinite(rawMax) && rawMax >= 1 ? Math.min(8, Math.floor(rawMax)) : DEFAULT_MAX_CONCURRENT_PAGES;
  }

  async onModuleDestroy(): Promise<void> {
    this.browserLaunchPromise = null;
    if (this.browser) {
      const current = this.browser;
      this.browser = null;
      await current.close().catch(() => undefined);
    }
  }

  private getCompiledTemplate(templateName: string): handlebars.TemplateDelegate {
    const cached = this.templateCache.get(templateName);
    if (cached) {
      return cached;
    }

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
    const compiled = handlebars.compile(templateContent);
    this.templateCache.set(templateName, compiled);
    return compiled;
  }

  private async acquireSlot(): Promise<void> {
    if (this.activePages < this.maxConcurrentPages) {
      this.activePages += 1;
      return;
    }
    await new Promise<void>((resolve) => {
      this.waitQueue.push(() => {
        this.activePages += 1;
        resolve();
      });
    });
  }

  private releaseSlot(): void {
    this.activePages = Math.max(0, this.activePages - 1);
    const next = this.waitQueue.shift();
    if (next) {
      next();
    }
  }

  private async getBrowser(): Promise<puppeteer.Browser> {
    if (this.browser && this.browser.connected) {
      return this.browser;
    }

    if (!this.browserLaunchPromise) {
      this.browserLaunchPromise = puppeteer
        .launch({
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
        })
        .then((instance) => {
          this.browser = instance;
          instance.once('disconnected', () => {
            if (this.browser === instance) {
              this.browser = null;
            }
          });
          return instance;
        })
        .finally(() => {
          this.browserLaunchPromise = null;
        });
    }

    return this.browserLaunchPromise;
  }

  async generatePdf(templateName: string, data: Record<string, unknown>): Promise<Buffer> {
    const compiledTemplate = this.getCompiledTemplate(templateName);
    const html = compiledTemplate(data);

    await this.acquireSlot();
    try {
      let browser = await this.getBrowser();
      let page: puppeteer.Page;
      try {
        page = await browser.newPage();
      } catch (err) {
        this.logger.warn(
          `Failed to open Puppeteer page on cached browser (${err instanceof Error ? err.message : 'unknown'}); relaunching.`,
        );
        await browser.close().catch(() => undefined);
        if (this.browser === browser) {
          this.browser = null;
        }
        browser = await this.getBrowser();
        page = await browser.newPage();
      }

      try {
        await page.setContent(html, { waitUntil: 'load' });
        const pdfBuffer = await page.pdf({ format: 'A4' });
        return Buffer.from(pdfBuffer);
      } finally {
        await page.close().catch(() => undefined);
      }
    } finally {
      this.releaseSlot();
    }
  }
}
