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
  app.enableCors({
    origin: config.get<string>('FRONTEND_URL', 'http://localhost:5173'),
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
    .setDescription('Phase 1 foundation endpoints')
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
