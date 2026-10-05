import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisModule } from './redis/redis.module';
import appConfig from './config/app.config';
import jwtConfig from './config/jwt.config';
import redisConfig from './config/redis.config';
import { envValidationSchema } from './config/env.validation';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // module nào cũng dùng được ConfigService
      load: [appConfig, jwtConfig, redisConfig],
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false }, // báo hết mọi lỗi một lượt
    }),
    RedisModule.forRootAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({ url: cfg.getOrThrow<string>('redis.url') }),
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
