import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  accessSecret: process.env.JWT_ACCESS_SECRET,
  accessTtl: process.env.JWT_ACCESS_TTL,
  refreshTtlSeconds: Number(process.env.REFRESH_TTL_SECONDS),
}));
