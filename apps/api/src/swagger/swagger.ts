import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

/**
 * Shared by main.ts (serving `/api/docs`) and `scripts/generate-openapi.ts`
 * (writing `packages/api-client/openapi.json`). Paths are generated without
 * the global `/api` prefix (`ignoreGlobalPrefix: true`) regardless of whether
 * the app instance already has it set, so the two callers always agree; the
 * `/api` server entry keeps Swagger UI's "Try it out" pointed at the real
 * route, and `createApiClient(baseUrl = '/api')` supplies the same prefix.
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Telehealth API')
    .setDescription('REST API for the telehealth prototype')
    .setVersion('0.1.0')
    .addServer('/api')
    .build();
  return SwaggerModule.createDocument(app, config, { ignoreGlobalPrefix: true });
}

export function setupSwagger(app: INestApplication): void {
  const document = buildOpenApiDocument(app);
  SwaggerModule.setup('docs', app, document, { useGlobalPrefix: true });
}
