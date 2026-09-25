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
            // pino-http calls this with its own already-summarized request object
            // (id/method/url/headers/…), not the live Express `req` — the
            // original request is available on `.raw`. `clientIp` is `req.ip`
            // (respects Express's `trust proxy` setting, so it's the real client
            // address from `X-Forwarded-For` when behind nginx) captured early by
            // `clientIpMiddleware`, since by the time this serializer runs, at
            // response-finish, `req.raw.ip` itself has already gone stale and
            // resolves to `undefined`.
            serializers: {
              req: (req: { id?: string; method?: string; url?: string; raw?: { clientIp?: string } }) => ({
                id: req.id,
                method: req.method,
                url: req.url,
                clientIp: req.raw?.clientIp,
              }),
            },
            redact: {
              paths: [
                'req.headers.cookie',
                'res.headers["set-cookie"]',
                '*.password',
                '*.currentPassword',
                '*.newPassword',
                '*.passwordHash',
              ],
              censor: '[Redacted]',
            },
          },
        };
      },
    }),
  ],
})
export class LoggingModule {}
