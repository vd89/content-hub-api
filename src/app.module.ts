import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ArticlesModule } from './articles/articles.module';
import { UsersModule } from './users/users.module';
import { CommonModule } from './common/common.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { TenantContextMiddleware } from './common/middleware/tenant-context.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Makes the config module global
      envFilePath: '.env', // Path to your .env file
    }),
    AuthModule,
    ArticlesModule,
    UsersModule,
    CommonModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware, LoggerMiddleware, TenantContextMiddleware).forRoutes('*');
  }
}
