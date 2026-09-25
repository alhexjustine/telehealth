import createFetchClient from 'openapi-fetch';
import type { paths } from './schema.js';

export type { paths as ApiPaths } from './schema.js';

export function createApiClient(baseUrl = '/api') {
  return createFetchClient<paths>({ baseUrl, credentials: 'include' });
}

export type ApiClient = ReturnType<typeof createApiClient>;
