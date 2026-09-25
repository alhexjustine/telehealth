import type { Role } from '../generated/prisma/enums.js';

/** Attached to `request.user` by `SessionAuthGuard` on every authenticated request. */
export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  sessionId: string;
}
