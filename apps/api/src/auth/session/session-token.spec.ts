import { describe, expect, it } from '@jest/globals';
import { generateSessionToken, hashSessionToken } from './session-token.js';

describe('session-token', () => {
  it('generates unique, high-entropy tokens', () => {
    const a = generateSessionToken();
    const b = generateSessionToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(40);
  });

  it('hashes the same token to the same value', () => {
    const token = generateSessionToken();
    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
  });

  it('hashes different tokens to different values', () => {
    const a = generateSessionToken();
    const b = generateSessionToken();
    expect(hashSessionToken(a)).not.toBe(hashSessionToken(b));
  });

  it('produces a 64-character hex digest', () => {
    const token = generateSessionToken();
    expect(hashSessionToken(token)).toMatch(/^[0-9a-f]{64}$/);
  });
});
