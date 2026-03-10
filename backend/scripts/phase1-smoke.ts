import 'dotenv/config';
import helmet from 'helmet';
import { AddressInfo } from 'node:net';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AppValidationPipe } from '../src/common/pipes/validation.pipe';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filter';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { LoggingInterceptor } from '../src/common/interceptors/logging.interceptor';
import { TimeoutInterceptor } from '../src/common/interceptors/timeout.interceptor';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

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

  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
  const loginJson = (await loginRes.json()) as any;

  if (!loginRes.ok || !loginJson?.data?.accessToken) {
    throw new Error('Login smoke test failed');
  }

  const accessToken = loginJson.data.accessToken as string;

  const profileRes = await fetch(`${baseUrl}/auth/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const profileJson = (await profileRes.json()) as any;

  const usersRes = await fetch(`${baseUrl}/users`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const usersJson = (await usersRes.json()) as any;

  await app.close();

  const summary = {
    loginStatus: loginRes.status,
    profileStatus: profileRes.status,
    usersStatus: usersRes.status,
    profileEmail: profileJson?.data?.email ?? null,
    profileRole: profileJson?.data?.role ?? null,
    usersTotal: usersJson?.data?.total ?? null,
  };

  console.log(JSON.stringify(summary));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
