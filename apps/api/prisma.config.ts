import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// `env()` from `prisma/config` throws immediately if the variable is unset,
// which would fail `prisma generate` (run from `postinstall`) on a fresh
// clone before any `.env` exists. `generate` never opens a connection, so a
// placeholder is safe here; `migrate`/`studio` need a real `DATABASE_URL`.
const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://telehealth:telehealth@localhost:5432/telehealth';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: DATABASE_URL,
  },
});
