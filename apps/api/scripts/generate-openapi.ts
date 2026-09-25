import 'reflect-metadata';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NestFactory } from '@nestjs/core';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Config validation runs when AppModule is evaluated, so a placeholder URL must be set before
// the dynamic import. Prisma connects lazily, so the placeholder is never dialed.
process.env.DATABASE_URL ??= 'postgresql://openapi:openapi@localhost:5432/openapi';

async function main(): Promise<void> {
  const { AppModule } = await import('../src/app.module.js');
  const { buildOpenApiDocument } = await import('../src/swagger/swagger.js');

  const app = await NestFactory.create(AppModule, { logger: false });
  await app.init();

  const document = buildOpenApiDocument(app);
  const outPath = resolve(__dirname, '../../../../packages/api-client/openapi.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(document, null, 2)}\n`);

  await app.close();
  console.log(`OpenAPI document written to ${outPath}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
