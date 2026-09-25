import type { Request, Response } from 'express';

export const SESSION_COOKIE_NAME = 'th_session';

export interface CookieOptions {
  secure: boolean;
}

export function setSessionCookie(res: Response, token: string, options: CookieOptions): void {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: options.secure,
    path: '/',
  });
}

export function clearSessionCookie(res: Response, options: CookieOptions): void {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: options.secure,
    path: '/',
  });
}

export function readSessionToken(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, string> | undefined;
  return cookies?.[SESSION_COOKIE_NAME];
}
