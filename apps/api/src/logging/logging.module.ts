import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import type { Request } from 'express';
import { REQUEST_ID_HEADER } from '../common/middleware/request-id.middleware.js';
import type { Env } from '../config/env.schema.js';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<Env, true>) => {
        const isDevelopment = configService.get('NODE_ENV', { infer: true }) === 'development';
        return {
          pinoHttp: {
            level: configService.get('LOG_LEVEL', { infer: true }),
            genReqId: (req: Request) => req.headers[REQUEST_ID_HEADER] as string,
            transport: isDevelopment
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
          },
        };
      },
    }),
  ],
})
export class LoggingModule {}
