import createFetchClient from 'openapi-fetch';
import type { paths, components } from './schema.js';

export type { paths as ApiPaths } from './schema.js';

export function createApiClient(baseUrl = '/api') {
  return createFetchClient<paths>({ baseUrl, credentials: 'include' });
}

export type ApiClient = ReturnType<typeof createApiClient>;

/** The standard API error body shape (see the NestJS API's `ErrorResponseDto`). */
export type ApiErrorBody = components['schemas']['ErrorResponseDto'];

/**
 * Extracts the stable, machine-readable `code` a business-rule violation
 * carries (e.g. `SLOT_UNAVAILABLE`), when the error body has one, so callers
 * can switch on it instead of matching `message` text.
 */
export function getApiErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

/** The `details` an error body carries for some codes (e.g. `SCHEDULE_CONFLICTS_WITH_BOOKINGS`'s affected appointments). */
export function getApiErrorDetails(error: unknown): unknown {
  if (typeof error !== 'object' || error === null || !('details' in error)) return undefined;
  return (error as { details?: unknown }).details;
}
