import {
  DynamicModule,
  Inject,
  Module,
  OnApplicationShutdown,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

export interface RedisModuleAsyncOptions {
  imports?: any[];
  inject?: any[];
  isGlobal?: boolean;
  useFactory: (...args: any[]) => { url: string };
}

@Module({})
export class RedisModule implements OnApplicationShutdown {
  // (3) Khi tắt app, Nest cần client để đóng kết nối
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  // (1) Hàm "cắm module kèm tham số"
  static forRootAsync(options: RedisModuleAsyncOptions): DynamicModule {
    return {
      module: RedisModule,
      global: options.isGlobal ?? false,
      imports: options.imports ?? [],
      providers: [
        {
          provide: REDIS_CLIENT, // dán nhãn
          inject: options.inject ?? [], // thứ cần để tạo (ví dụ ConfigService)
          useFactory: (...args: any[]) => {
            // công thức tạo ra kết nối
            const { url } = options.useFactory(...args);
            return new Redis(url);
          },
        },
      ],
      exports: [REDIS_CLIENT], // cho module khác dùng
    };
  }

  // (2) Nest tự gọi hàm này khi app tắt
  async onApplicationShutdown() {
    await this.client.quit();
  }
}
