import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import { requestIdMiddleware } from '../../src/common/middleware/request-id.middleware.js';
import { setupSwagger } from '../../src/swagger/swagger.js';

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.use(requestIdMiddleware);
  app.setGlobalPrefix('api');
  setupSwagger(app);
  await app.init();
  return app;
}
