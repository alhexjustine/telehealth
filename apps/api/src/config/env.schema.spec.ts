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
  });
});
