import { SESSION_COOKIE_NAME } from '../auth/session/session-cookie.js';

/**
 * The socket.io handshake exposes the raw `Cookie` header, not Express's
 * parsed `req.cookies` (`cookie-parser` never runs for the ws upgrade). A
 * session token never contains `;` or `=`, so a minimal split is enough —
 * no need to pull in a full cookie-parsing dependency for one name lookup.
 */
export function readSessionTokenFromHandshake(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) return undefined;

  for (const part of cookieHeader.split(';')) {
    const separatorIndex = part.indexOf('=');
    if (separatorIndex === -1) continue;
    const name = part.slice(0, separatorIndex).trim();
    if (name !== SESSION_COOKIE_NAME) continue;
    const value = part.slice(separatorIndex + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  return undefined;
}
