import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { requestIdMiddleware } from '../common/middleware/request-id.middleware.js';
import { clientIpMiddleware } from '../common/middleware/client-ip.middleware.js';
import { createOriginCheckMiddleware } from '../common/middleware/origin-check.middleware.js';
import type { Env } from '../config/env.schema.js';

/**
 * Applies the middleware, validation, and Swagger setup shared by the running app
 * (`main.ts`), the e2e test harness (`test/support/test-app.ts`), and OpenAPI
 * generation (`scripts/generate-openapi.ts`), so the three never drift again.
 *
 * `setupSwagger` is opt-out (default on) so OpenAPI generation, which builds its
 * own document separately, does not need to also serve the Swagger UI route.
 */
export function configureApp(app: INestApplication, options: { setupSwagger?: boolean } = {}): void {
  const configService = app.get(ConfigService<Env, true>);

  // Cast: `INestApplication` doesn't expose the underlying Express instance's
  // `.set()`, but `getHttpAdapter().getInstance()` returns it at runtime.
  (app.getHttpAdapter().getInstance() as { set(key: string, value: unknown): void }).set(
    'trust proxy',
    1,
  );
  app.use(requestIdMiddleware);
  app.use(clientIpMiddleware);
  app.use(cookieParser());
  app.use(createOriginCheckMiddleware(configService.get('APP_ORIGINS', { infer: true })));
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          'script-src': ["'self'", "'unsafe-inline'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:'],
        },
      },
    }),
  );
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  if (options.setupSwagger ?? true) {
    const document = buildOpenApiDocument(app);
    SwaggerModule.setup('docs', app, document, { useGlobalPrefix: true });
  }
}

/**
 * Builds the OpenAPI document alone (no UI mount), used both by `configureApp`
 * and directly by `scripts/generate-openapi.ts`. Paths are generated without the
 * global `/api` prefix (`ignoreGlobalPrefix: true`) regardless of whether the app
 * instance already has it set, so every caller agrees; the `/api` server entry
 * keeps Swagger UI's "Try it out" pointed at the real route, and
 * `createApiClient(baseUrl = '/api')` supplies the same prefix.
 */
export function buildOpenApiDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('Telehealth API')
    .setDescription('REST API for the telehealth prototype')
    .setVersion('0.1.0')
    .addServer('/api')
    .addCookieAuth('th_session', {
      type: 'apiKey',
      in: 'cookie',
      name: 'th_session',
      description: 'Opaque session token set by POST /auth/login or a registration endpoint.',
    })
    .build();
  return SwaggerModule.createDocument(app, config, { ignoreGlobalPrefix: true });
}
