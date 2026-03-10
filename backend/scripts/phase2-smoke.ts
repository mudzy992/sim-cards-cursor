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
  const operatorEmail = `operator.${unique}@simtracker.local`;
  const operatorPassword = 'Operator123!';

  const register = await requestJson<Envelope<{ id: string; email: string }>>(
    `${baseUrl}/auth/register`,
    {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        email: operatorEmail,
        password: operatorPassword,
        firstName: 'Field',
        lastName: 'Operator',
        role: 'USER',
      }),
    },
  );

  const shipment = await requestJson<Envelope<{ id: string }>>(`${baseUrl}/shipments`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      name: `Shipment ${unique}`,
      provider: 'Test Provider',
      receivedDate: new Date().toISOString(),
      totalCards: 1,
      notes: 'Phase2 smoke',
    }),
  });

  const iccid = `8938100000${unique}`;
  const simCard = await requestJson<Envelope<{ id: string; status: string }>>(
    `${baseUrl}/sim-cards`,
    {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        iccid,
        ipAddress: '10.0.0.10',
        publicIpAddress: '82.1.1.1',
        shipmentId: shipment.data.data.id,
      }),
    },
  );

  const claimIccid = `8938100000${unique}77`;
  const claimCandidate = await requestJson<Envelope<{ id: string; status: string }>>(
    `${baseUrl}/sim-cards`,
    {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        iccid: claimIccid,
        ipAddress: '10.0.0.77',
        publicIpAddress: '82.1.1.77',
        shipmentId: shipment.data.data.id,
      }),
    },
  );

  const assigned = await requestJson<Envelope<{ status: string }>>(
    `${baseUrl}/sim-cards/${simCard.data.data.id}/assign`,
    {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ userId: register.data.data.id }),
    },
  );

  const operatorLogin = await requestJson<Envelope<LoginResponse>>(
    `${baseUrl}/auth/login`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: operatorEmail, password: operatorPassword }),
    },
  );

  const operatorHeaders = {
    Authorization: `Bearer ${operatorLogin.data.data.accessToken}`,
  };

  const scanned = await requestJson<Envelope<{ iccid: string; status: string }>>(
    `${baseUrl}/sim-cards/scan/${iccid}`,
    {
      method: 'GET',
      headers: operatorHeaders,
    },
  );

  const claimScan = await requestJson<Envelope<{ id: string; iccid: string; status: string }>>(
    `${baseUrl}/sim-cards/scan/${claimIccid}`,
    {
      method: 'GET',
      headers: operatorHeaders,
    },
  );

  const claimed = await requestJson<Envelope<{ status: string; assignedTo: { id: string } }>>(
    `${baseUrl}/sim-cards/${claimScan.data.data.id}/claim`,
    {
      method: 'POST',
      headers: operatorHeaders,
    },
  );

  const scanNotFound = await requestJson<Envelope<{ message: string }>>(
    `${baseUrl}/sim-cards/scan/8938999999999999999999`,
    {
      method: 'GET',
      headers: operatorHeaders,
    },
  );

  const myAssigned = await requestJson<Envelope<{ total: number }>>(
    `${baseUrl}/sim-cards/my-assigned`,
    {
      method: 'GET',
      headers: operatorHeaders,
    },
  );

  const activityLogs = await requestJson<Envelope<{ total: number }>>(
    `${baseUrl}/activity-log`,
    {
      method: 'GET',
      headers: adminHeaders,
    },
  );

  await app.close();

  const summary = {
    loginStatus: adminLogin.status,
    registerStatus: register.status,
    shipmentCreateStatus: shipment.status,
    simCreateStatus: simCard.status,
    claimCandidateCreateStatus: claimCandidate.status,
    assignStatus: assigned.status,
    scanStatus: scanned.status,
    claimScanStatus: claimScan.status,
    claimStatus: claimed.status,
    scanNotFoundStatus: scanNotFound.status,
    myAssignedStatus: myAssigned.status,
    activityLogStatus: activityLogs.status,
    simStatusAfterAssign: assigned.data.data.status,
    simStatusAfterClaim: claimed.data.data.status,
    scannedIccid: scanned.data.data.iccid,
    claimedIccid: claimScan.data.data.iccid,
    claimAssignedToId: claimed.data.data.assignedTo.id,
    myAssignedTotal: myAssigned.data.data.total,
    activityLogTotal: activityLogs.data.data.total,
  };

  console.log(JSON.stringify(summary));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
