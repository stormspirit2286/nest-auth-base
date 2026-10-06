import {
  MiddlewareConsumer,
  Module,
  NestModule,
  ValidationPipe,
} from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisModule } from './redis/redis.module';
import appConfig from './config/app.config';
import jwtConfig from './config/jwt.config';
import redisConfig from './config/redis.config';
import databaseConfig from './config/database.config';
import { envValidationSchema } from './config/env.validation';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggerModule } from 'nestjs-pino';
import { Request } from 'express';
import { TypeOrmModule } from '@nestjs/typeorm';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // module nào cũng dùng được ConfigService
      load: [appConfig, jwtConfig, redisConfig, databaseConfig],
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false }, // báo hết mọi lỗi một lượt
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => {
        const isProd = cfg.getOrThrow<string>('app.nodeEnv') === 'production';
        return {
          pinoHttp: {
            level: isProd ? 'info' : 'debug',
            // Dev: log đẹp màu mè. Prod: giữ JSON raw để ship ELK/Datadog.
            transport: isProd
              ? undefined
              : {
                  target: 'pino-pretty',
                  options: {
                    singleLine: true,
                    translateTime: 'SYS:HH:MM:ss',
                    ignore: 'pid,hostname,req,res,responseTime',
                  },
                },
            // Dùng lại x-request-id do RequestIdMiddleware đã sinh ra → log và response body cùng ID.
            genReqId: (req) =>
              (req.headers['x-request-id'] as string) ?? 'unknown',
            // Ẩn header nhạy cảm khỏi log.
            serializers: {
              req: (req: Request) => ({
                id: req.id,
                method: req.method,
                url: req.url,
              }),
            },
          },
        };
      },
    }),
    RedisModule.forRootAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        url: cfg.getOrThrow<string>('redis.url'),
      }),
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        url: cfg.getOrThrow<string>('database.url'),
        autoLoadEntities: true,
        synchronize: false, // KHÔNG BAO GIỜ true, để migration lo schema
      }),
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('{*splat}');
  }
}
