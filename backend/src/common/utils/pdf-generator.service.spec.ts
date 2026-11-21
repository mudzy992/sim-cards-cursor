import * as fs from 'fs';
import * as puppeteer from 'puppeteer';
import { PdfGeneratorService } from './pdf-generator.service';

jest.mock('puppeteer', () => ({
  launch: jest.fn(),
}));

describe('PdfGeneratorService', () => {
  const mockedLaunch = puppeteer.launch as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.PDF_MAX_CONCURRENCY;
  });

  function createFakeBrowser() {
    let active = 0;
    let maxObserved = 0;
    const listeners = new Map<string, () => void>();

    const browser = {
      connected: true,
      once: jest.fn((event: string, cb: () => void) => {
        listeners.set(event, cb);
      }),
      close: jest.fn(async () => {
        browser.connected = false;
      }),
      newPage: jest.fn(async () => {
        active += 1;
        maxObserved = Math.max(maxObserved, active);
        return {
          setContent: jest.fn(async () => {
            await new Promise((r) => setTimeout(r, 20));
          }),
          pdf: jest.fn(async () => Buffer.from('%PDF-1.4\n%fake')),
          close: jest.fn(async () => {
            active -= 1;
          }),
        };
      }),
      getMaxObservedConcurrency: () => maxObserved,
      triggerDisconnected: () => {
        browser.connected = false;
        listeners.get('disconnected')?.();
      },
    };
    return browser;
  }

  it('reuses a single browser across concurrent generatePdf calls and enforces bounded concurrency', async () => {
    process.env.PDF_MAX_CONCURRENCY = '2';
    const fakeBrowser = createFakeBrowser();
    mockedLaunch.mockResolvedValue(fakeBrowser);

    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'readFileSync').mockReturnValue('<p>{{recordNumber}}</p>');

    const service = new PdfGeneratorService();

    const results = await Promise.all([
      service.generatePdf('installation-record', { recordNumber: 'REC-1' }),
      service.generatePdf('installation-record', { recordNumber: 'REC-2' }),
      service.generatePdf('installation-record', { recordNumber: 'REC-3' }),
      service.generatePdf('installation-record', { recordNumber: 'REC-4' }),
    ]);

    expect(results).toHaveLength(4);
    for (const buf of results) {
      expect(buf.toString('utf8')).toContain('%PDF-1.4');
    }

    // Only one Chromium process launched for all 4 PDFs
    expect(mockedLaunch).toHaveBeenCalledTimes(1);
    expect(fakeBrowser.getMaxObservedConcurrency()).toBeLessThanOrEqual(2);

    await service.onModuleDestroy();
    expect(fakeBrowser.close).toHaveBeenCalledTimes(1);
  });

  it('relaunches Chromium cleanly if the cached browser disconnects', async () => {
    const firstBrowser = createFakeBrowser();
    const secondBrowser = createFakeBrowser();
    mockedLaunch.mockResolvedValueOnce(firstBrowser).mockResolvedValueOnce(secondBrowser);

    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'readFileSync').mockReturnValue('<p>{{recordNumber}}</p>');

    const service = new PdfGeneratorService();

    await service.generatePdf('installation-record', { recordNumber: 'REC-1' });
    firstBrowser.triggerDisconnected();
    await service.generatePdf('installation-record', { recordNumber: 'REC-2' });

    expect(mockedLaunch).toHaveBeenCalledTimes(2);
    await service.onModuleDestroy();
    expect(secondBrowser.close).toHaveBeenCalledTimes(1);
  });
});
