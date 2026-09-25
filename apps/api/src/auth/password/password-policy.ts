export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

/**
 * The single source of truth for the password policy (length, and not equal to
 * the account email), used by both registration and password change so the
 * rule can never drift between the two call sites.
 */
export function isPasswordPolicyValid(password: string, email: string): boolean {
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    return false;
  }
  return password.toLowerCase() !== email.toLowerCase();
}
