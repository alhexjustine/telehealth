/**
 * Accepts a `returnTo` redirect target only if it is a same-site, single
 * leading-slash path: not empty, not protocol-relative (`//evil.example`),
 * and not carrying a scheme (`https://evil.example`). Backslashes and control
 * characters are rejected too, because URL parsers treat `/\evil.example` as
 * `//evil.example`. Anything else is rejected so a signed-in user can never be
 * bounced off-site after signing in.
 */
export function sanitizeReturnTo(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith('/')) return null;
  if (value.startsWith('//')) return null;
  if (value.includes('://')) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return null;
  return value;
}
