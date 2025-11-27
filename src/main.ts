import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  try {
    const app = await NestFactory.create(AppModule);
    await app.listen(process.env.PORT ?? 3000);

    logger.log(`Environment: ${process.env.ENVIRONMENT ?? 'production'}`);

    logger.log(`Application is running on: http://localhost:${process.env.PORT ?? 3000}`);
  } catch (error) {
    logger.error('Error during application bootstrap', error);
    process.exit(1);
  }
}

void bootstrap();
