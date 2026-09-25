import { describe, expect, it } from '@jest/globals';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, isPasswordPolicyValid } from './password-policy.js';

describe('isPasswordPolicyValid', () => {
  const email = 'patient@example.com';

  it('rejects a password shorter than the minimum length', () => {
    const password = 'a'.repeat(PASSWORD_MIN_LENGTH - 1);
    expect(isPasswordPolicyValid(password, email)).toBe(false);
  });

  it('accepts a password at the minimum length', () => {
    const password = 'a'.repeat(PASSWORD_MIN_LENGTH);
    expect(isPasswordPolicyValid(password, email)).toBe(true);
  });

  it('accepts a password at the maximum length', () => {
    const password = 'a'.repeat(PASSWORD_MAX_LENGTH);
    expect(isPasswordPolicyValid(password, email)).toBe(true);
  });

  it('rejects a password longer than the maximum length', () => {
    const password = 'a'.repeat(PASSWORD_MAX_LENGTH + 1);
    expect(isPasswordPolicyValid(password, email)).toBe(false);
  });

  it('rejects a password equal to the email, case-insensitively', () => {
    expect(isPasswordPolicyValid('Patient@Example.com', email)).toBe(false);
  });

  it('accepts a valid password that differs from the email', () => {
    expect(isPasswordPolicyValid('correct-horse-battery', email)).toBe(true);
  });
});
