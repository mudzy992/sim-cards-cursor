import 'dotenv/config';
import helmet from 'helmet';
import { AddressInfo } from 'node:net';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filter';
import { LoggingInterceptor } from '../src/common/interceptors/logging.interceptor';
import { TimeoutInterceptor } from '../src/common/interceptors/timeout.interceptor';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AppValidationPipe } from '../src/common/pipes/validation.pipe';

type Envelope<T> = { success: boolean; data: T };

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; role: string };
};

type ImportPreviewResponse = Envelope<{
  mode: 'preview';
  canImport: boolean;
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    duplicatesInFile: number;
    duplicatesInDatabase: number;
  };
}>;

async function requestJson<T>(
  url: string,
  init: RequestInit = {},
): Promise<{ status: number; data: T }> {
  const response = await fetch(url, init);
  const data = (await response.json()) as T;
  return { status: response.status, data };
}

async function previewImport(
  baseUrl: string,
  token: string,
  shipmentId: string,
  csvContent: string,
): Promise<{ status: number; data: ImportPreviewResponse }> {
  const formData = new FormData();
  formData.append('file', new Blob([csvContent], { type: 'text/csv' }), 'import.csv');
  formData.append('applyImport', 'false');
  formData.append(
    'columnMapping',
    JSON.stringify({
      iccid: 'ICCID',
      ipAddress: 'Private IP',
    }),
  );

  return requestJson<ImportPreviewResponse>(`${baseUrl}/shipments/${shipmentId}/import`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
}

async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });

  app.setGlobalPrefix('api');
  app.use(helmet());
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(new AppValidationPipe());
  app.useGlobalFilters(new PrismaExceptionFilter(), new HttpExceptionFilter());
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TimeoutInterceptor(),
    new TransformInterceptor(),
  );

  await app.listen(0);
  const port = (app.getHttpServer().address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@simtracker.local';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'ChangeMe123!';

  const adminLogin = await requestJson<Envelope<LoginResponse>>(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });

  const adminToken = adminLogin.data.data.accessToken;
  const adminHeaders = {
    Authorization: `Bearer ${adminToken}`,
    'Content-Type': 'application/json',
  };

  const unique = Date.now();

  const dupShipment = await requestJson<Envelope<{ id: string }>>(`${baseUrl}/shipments`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      name: `Validation Duplicate File ${unique}`,
      provider: 'Validation',
      receivedDate: new Date().toISOString(),
      totalCards: 0,
    }),
  });

  const duplicateIccid = `8938100000${unique}11`;
  const duplicateInFileCsv = [
    'ICCID,Private IP',
    `${duplicateIccid},10.10.11.1`,
    `${duplicateIccid},10.10.11.2`,
  ].join('\n');

  const duplicateInFilePreview = await previewImport(
    baseUrl,
    adminToken,
    dupShipment.data.data.id,
    duplicateInFileCsv,
  );

  const invalidShipment = await requestJson<Envelope<{ id: string }>>(`${baseUrl}/shipments`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      name: `Validation Invalid ICCID ${unique}`,
      provider: 'Validation',
      receivedDate: new Date().toISOString(),
      totalCards: 0,
    }),
  });

  const invalidIccidCsv = ['ICCID,Private IP', `ABC-INVALID-${unique},10.10.22.1`].join('\n');

  const invalidIccidPreview = await previewImport(
    baseUrl,
    adminToken,
    invalidShipment.data.data.id,
    invalidIccidCsv,
  );

  const existingShipment = await requestJson<Envelope<{ id: string }>>(`${baseUrl}/shipments`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      name: `Validation Existing DB ${unique}`,
      provider: 'Validation',
      receivedDate: new Date().toISOString(),
      totalCards: 1,
    }),
  });

  const dbDuplicateIccid = `8938100000${unique}33`;

  await requestJson(`${baseUrl}/sim-cards`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      iccid: dbDuplicateIccid,
      ipAddress: '10.10.33.1',
      shipmentId: existingShipment.data.data.id,
    }),
  });

  const previewShipment = await requestJson<Envelope<{ id: string }>>(`${baseUrl}/shipments`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      name: `Validation Preview Existing ${unique}`,
      provider: 'Validation',
      receivedDate: new Date().toISOString(),
      totalCards: 0,
    }),
  });

  const duplicateInDatabaseCsv = ['ICCID,Private IP', `${dbDuplicateIccid},10.10.44.1`].join(
    '\n',
  );

  const duplicateInDatabasePreview = await previewImport(
    baseUrl,
    adminToken,
    previewShipment.data.data.id,
    duplicateInDatabaseCsv,
  );

  await app.close();

  console.log(
    JSON.stringify({
      duplicateInFile: {
        status: duplicateInFilePreview.status,
        canImport: duplicateInFilePreview.data.data.canImport,
        invalidRows: duplicateInFilePreview.data.data.summary.invalidRows,
        duplicatesInFile: duplicateInFilePreview.data.data.summary.duplicatesInFile,
      },
      invalidIccid: {
        status: invalidIccidPreview.status,
        canImport: invalidIccidPreview.data.data.canImport,
        invalidRows: invalidIccidPreview.data.data.summary.invalidRows,
      },
      duplicateInDatabase: {
        status: duplicateInDatabasePreview.status,
        canImport: duplicateInDatabasePreview.data.data.canImport,
        invalidRows: duplicateInDatabasePreview.data.data.summary.invalidRows,
        duplicatesInDatabase:
          duplicateInDatabasePreview.data.data.summary.duplicatesInDatabase,
      },
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
