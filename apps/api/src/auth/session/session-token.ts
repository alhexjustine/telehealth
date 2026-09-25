import { createHash, randomBytes } from 'node:crypto';

/** 32 random bytes, base64url-encoded: the opaque value stored in the session cookie. */
export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * SHA-256 is sufficient here (not a password hash): the token is already
 * high-entropy random data, so there is nothing for an attacker to brute-force
 * from the hash, and SHA-256 allows a fast, indexed lookup on every request.
 */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
