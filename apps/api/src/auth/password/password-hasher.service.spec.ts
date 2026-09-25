import { describe, expect, it } from '@jest/globals';
import { PasswordHasherService } from './password-hasher.service.js';

describe('PasswordHasherService', () => {
  const service = new PasswordHasherService();

  it('hashes and verifies a matching password', async () => {
    const hash = await service.hash('correct-horse-battery');
    expect(hash).not.toBe('correct-horse-battery');
    await expect(service.verify(hash, 'correct-horse-battery')).resolves.toBe(true);
  });

  it('rejects a non-matching password', async () => {
    const hash = await service.hash('correct-horse-battery');
    await expect(service.verify(hash, 'wrong-password')).resolves.toBe(false);
  });

  it('verifyOrDummy returns false for an undefined hash without throwing', async () => {
    await expect(service.verifyOrDummy(undefined, 'anything')).resolves.toBe(false);
  });

  it('verifyOrDummy behaves like verify for a real hash', async () => {
    const hash = await service.hash('correct-horse-battery');
    await expect(service.verifyOrDummy(hash, 'correct-horse-battery')).resolves.toBe(true);
    await expect(service.verifyOrDummy(hash, 'wrong-password')).resolves.toBe(false);
  });
});
