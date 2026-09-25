import type { ApiPaths } from 'api-client';

export type CurrentUser = NonNullable<
  ApiPaths['/auth/me']['get']['responses'][200]['content']['application/json']
>;

export type Role = CurrentUser['role'];
