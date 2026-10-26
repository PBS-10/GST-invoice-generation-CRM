import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { json } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { loadConfig } from './config';
import { AppExceptionFilter } from './http/zod-exception.filter';

async function bootstrap() {
  const config = loadConfig();
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  app.use(helmet());
  app.use(json({ limit: '1mb' }));
  app.useGlobalFilters(new AppExceptionFilter());
  app.enableCors({
    origin: config.corsOrigins.includes('*') ? true : config.corsOrigins,
    credentials: true,
  });
  app.enableShutdownHooks();

  await app.listen(config.PORT);
  Logger.log(`API listening on :${config.PORT}`, 'Bootstrap');
}

void bootstrap();
