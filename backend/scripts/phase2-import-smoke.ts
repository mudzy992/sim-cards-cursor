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

async function requestJson<T>(
  url: string,
  init: RequestInit = {},
): Promise<{ status: number; data: T }> {
  const response = await fetch(url, init);
  const data = (await response.json()) as T;
  return { status: response.status, data };
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

  const shipment = await requestJson<Envelope<{ id: string }>>(`${baseUrl}/shipments`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      name: `Import Shipment ${unique}`,
      provider: 'Import Provider',
      receivedDate: new Date().toISOString(),
      totalCards: 0,
      notes: 'Import smoke',
    }),
  });

  const shipmentId = shipment.data.data.id;

  const csv = [
    'ICCID,Private IP,Public IP',
    `8938100000${unique}01,10.10.1.1,82.1.2.1`,
    `8938100000${unique}02,10.10.1.2,82.1.2.2`,
  ].join('\n');

  const previewForm = new FormData();
  previewForm.append('file', new Blob([csv], { type: 'text/csv' }), 'import.csv');
  previewForm.append('applyImport', 'false');
  previewForm.append(
    'columnMapping',
    JSON.stringify({
      iccid: 'ICCID',
      ipAddress: 'Private IP',
      publicIpAddress: 'Public IP',
    }),
  );

  const preview = await requestJson<Envelope<any>>(
    `${baseUrl}/shipments/${shipmentId}/import`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: previewForm,
    },
  );

  const applyForm = new FormData();
  applyForm.append('file', new Blob([csv], { type: 'text/csv' }), 'import.csv');
  applyForm.append('applyImport', 'true');
  applyForm.append(
    'columnMapping',
    JSON.stringify({
      iccid: 'ICCID',
      ipAddress: 'Private IP',
      publicIpAddress: 'Public IP',
    }),
  );

  const apply = await requestJson<Envelope<any>>(`${baseUrl}/shipments/${shipmentId}/import`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: applyForm,
  });

  const simCards = await requestJson<Envelope<{ total: number }>>(
    `${baseUrl}/shipments/${shipmentId}/sim-cards`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` },
    },
  );

  await app.close();

  console.log(
    JSON.stringify({
      previewStatus: preview.status,
      applyStatus: apply.status,
      previewCanImport: preview.data.data.canImport,
      insertedRows: apply.data.data.insertedRows,
      shipmentSimTotal: simCards.data.data.total,
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
