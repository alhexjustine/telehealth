import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marks a route as reachable without a session. Everything else is denied by default. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
