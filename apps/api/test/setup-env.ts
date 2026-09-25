process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://telehealth:telehealth@localhost:5432/telehealth_test?schema=public';
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'silent';
