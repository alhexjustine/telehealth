import { SetMetadata } from '@nestjs/common';
import { Role } from '../../generated/prisma/enums.js';

export const ROLES_KEY = 'roles';

/** Restricts a route to the given roles. Requires `SessionAuthGuard` to run first. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
