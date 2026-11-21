import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';
import helmet from 'helmet';
import { Prisma } from '@prisma/client';
import { IoAdapter } from '@nestjs/platform-socket.io';

try {
  const DecimalProto = Prisma?.Decimal?.prototype as
    | { toJSON?: () => unknown }
    | undefined;

  if (DecimalProto) {
    DecimalProto.toJSON = function (this: { toString: () => string }) {
      return Number(this.toString());
    };
  }
} catch {
  // ignore
}

import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AppValidationPipe } from './common/pipes/validation.pipe';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const expressApp = app.getHttpAdapter().getInstance() as {
    set?: (key: string, value: unknown) => void;
  };
  expressApp.set?.('trust proxy', 1);

  app.useWebSocketAdapter(new IoAdapter(app));

  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  app.use(helmet());

  const appEnv = config.get<string>(
    'APP_ENV',
    process.env.NODE_ENV || 'development',
  );

  const isDev = appEnv === 'development';

  const frontendUrls =
    config.get<string>('FRONTEND_URLS') ??
    config.get<string>('FRONTEND_URL') ??
    '';

  const envOrigins = [
    ...new Set(
      frontendUrls
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];

  const allowedHostnames = new Set<string>(
    isDev ? ['localhost', '127.0.0.1'] : [],
  );

  for (const envOrigin of envOrigins) {
    try {
      allowedHostnames.add(new URL(envOrigin).hostname);
    } catch {
      // ignore invalid origin
    }
  }

  const allowedOriginsExact = new Set<string>([
    ...(isDev ? ['http://localhost:3004', 'http://localhost:5173'] : []),
    ...envOrigins,
  ]);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOriginsExact.has(origin)) {
        return callback(null, true);
      }

      try {
        const url = new URL(origin);
        if (allowedHostnames.has(url.hostname)) {
          return callback(null, true);
        }
      } catch {
        // ignore
      }

      logger.warn(`CORS blocked for origin: ${origin} (env=${appEnv})`);
      return callback(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
  });

  app.useGlobalPipes(new AppValidationPipe());
  const globalPrefix = config.get<string>('API_GLOBAL_PREFIX', '');
  if (globalPrefix) {
    app.setGlobalPrefix(globalPrefix);
  }

  app.useGlobalFilters(new PrismaExceptionFilter(), new HttpExceptionFilter());

  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TimeoutInterceptor(),
    new TransformInterceptor(),
  );

  const swaggerEnabled =
    isDev || config.get<string>('SWAGGER_ENABLED') === 'true';

  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('SIM Tracker API')
      .setDescription('V1 - 12.03.2026')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    const publicBasePath = config.get<string>('SWAGGER_PUBLIC_BASE_PATH', '');
    document.servers = [{ url: publicBasePath }];
    SwaggerModule.setup('docs', app, document);
  }

  app.enableShutdownHooks();

  const uploadRoot = config.get<string>(
    'UPLOAD_ROOT_PATH',
    path.join(process.cwd(), 'uploads'),
  );
  try {
    fs.mkdirSync(uploadRoot, { recursive: true });
    fs.accessSync(uploadRoot, fs.constants.W_OK | fs.constants.X_OK);
    const recordsDir = path.join(uploadRoot, 'installation-records');
    if (fs.existsSync(recordsDir)) {
      fs.accessSync(recordsDir, fs.constants.W_OK | fs.constants.X_OK);
    }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code ?? 'ERR';
    const uid = process.getuid?.();
    const gid = process.getgid?.();
    logger.error(
      `Uploads directory "${uploadRoot}" is not writable (${code}, uid=${uid}, gid=${gid}). ` +
        'If using a host bind mount, run: chown -R 1000:1000 <host_uploads_dir>',
    );
  }

  const port = Number(config.get('PORT', 3003));
  await app.listen(port, '0.0.0.0');

  logger.log(`API running on http://0.0.0.0:${port}`);
  if (swaggerEnabled) {
    logger.log(`Swagger at http://0.0.0.0:${port}/docs`);
  }
}

void bootstrap();
