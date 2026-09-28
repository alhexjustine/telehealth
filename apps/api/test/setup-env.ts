process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://telehealth:telehealth@localhost:5432/telehealth_test?schema=public';
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'silent';
// Never let the reminder cron keep Jest alive; e2e tests call ReminderService.run() directly.
process.env.REMINDERS_ENABLED = process.env.REMINDERS_ENABLED ?? 'false';
process.env.JITSI_ROOM_SECRET = process.env.JITSI_ROOM_SECRET ?? 'test-only-jitsi-secret';
