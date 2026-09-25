import { describe, expect, it, jest } from '@jest/globals';
import { validateEnv } from './env.schema.js';

describe('validateEnv', () => {
  it('Missing database URL', () => {
    const exit = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    validateEnv({ NODE_ENV: 'test' });

    expect(exit).toHaveBeenCalledWith(1);
    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining('DATABASE_URL'));

    exit.mockRestore();
    errorLog.mockRestore();
  });

  it('accepts a valid configuration and fills in defaults', () => {
    const config = validateEnv({ DATABASE_URL: 'postgresql://localhost:5432/db' });

    expect(config.DATABASE_URL).toBe('postgresql://localhost:5432/db');
    expect(config.PORT).toBe(3000);
    expect(config.NODE_ENV).toBe('development');
    expect(config.LOG_LEVEL).toBe('info');
    expect(config.APP_ORIGINS).toEqual(['http://localhost:8080', 'http://localhost:5173']);
    expect(config.COOKIE_SECURE).toBe(false);
    expect(config.SESSION_IDLE_MINUTES).toBe(120);
    expect(config.SESSION_ABSOLUTE_HOURS).toBe(12);
    expect(config.ADMIN_EMAIL).toBeUndefined();
    expect(config.ADMIN_PASSWORD).toBeUndefined();
  });

  it('parses a comma-separated APP_ORIGINS list', () => {
    const config = validateEnv({
      DATABASE_URL: 'postgresql://localhost:5432/db',
      APP_ORIGINS: 'https://a.example, https://b.example',
    });

    expect(config.APP_ORIGINS).toEqual(['https://a.example', 'https://b.example']);
  });

  it('coerces COOKIE_SECURE from a string', () => {
    const config = validateEnv({
      DATABASE_URL: 'postgresql://localhost:5432/db',
      COOKIE_SECURE: 'true',
    });

    expect(config.COOKIE_SECURE).toBe(true);
  });

  it('accepts optional admin credentials', () => {
    const config = validateEnv({
      DATABASE_URL: 'postgresql://localhost:5432/db',
      ADMIN_EMAIL: 'admin@telehealth.local',
      ADMIN_PASSWORD: 'ChangeMe-Admin-2026',
    });

    expect(config.ADMIN_EMAIL).toBe('admin@telehealth.local');
    expect(config.ADMIN_PASSWORD).toBe('ChangeMe-Admin-2026');
  });
});
