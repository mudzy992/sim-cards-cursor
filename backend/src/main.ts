import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Prisma } from '@prisma/client';

// Prisma Decimal ne može se serijalizovati u JSON – override toJSON
try {
  const DecimalProto = Prisma?.Decimal?.prototype as { toJSON?: () => unknown } | undefined;
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
import { PrismaService } from './prisma/prisma.service';
import { AppModule } from './app.module';
import { IoAdapter } from '@nestjs/platform-socket.io';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useWebSocketAdapter(new IoAdapter(app));
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  app.setGlobalPrefix('api');
  app.use(helmet());
  // APP_ENV je jedina istina za okruženje (development / production) – čita se iz .env
  // Ako APP_ENV nije postavljen, fallback je na NODE_ENV ili 'development'
  const appEnv = config.get<string>('APP_ENV', process.env.NODE_ENV || 'development');
  const isDev = appEnv === 'development';

  const devOrigins = ['http://localhost:3004'];
  const prodOrigins = [
    ...new Set(
      (config
        .get<string>('FRONTEND_URLS', config.get<string>('FRONTEND_URL', 'http://ep-sim.epbih.ba'))
        ?.split(',')
        .map((s) => s.trim())
        .filter(Boolean) ?? []),
    ),
  ];
  const allowedOrigins = isDev ? devOrigins : prodOrigins;

  app.enableCors({
    origin: (origin, callback) => {
      // Dozvoli zahtjeve bez Origin headera (npr. Postman, backend-2-backend)
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      logger.warn(`CORS blocked for origin: ${origin} (env=${appEnv})`);
      return callback(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
  });

  app.useGlobalPipes(new AppValidationPipe());
  app.useGlobalFilters(new PrismaExceptionFilter(), new HttpExceptionFilter());
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TimeoutInterceptor(),
    new TransformInterceptor(),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('SIM Tracker API')
    .setDescription('V1 - 12.03.2026')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.get(PrismaService).enableShutdownHooks(app);

  const port = Number(config.get('PORT', 3003));
  await app.listen(port);
  logger.log(`API running at http://localhost:${port}/api`);
  logger.log(`Swagger at http://localhost:${port}/api/docs`);
}

void bootstrap();
