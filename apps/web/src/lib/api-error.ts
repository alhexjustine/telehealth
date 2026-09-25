export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message: string;
  requestId: string;
  /** Stable machine-readable code for a business-rule violation, e.g. SLOT_UNAVAILABLE. */
  code?: string;
  /** Extra structured detail for some codes, e.g. the appointments a schedule change would orphan. */
  details?: unknown;
}

const STATUS_FALLBACKS: Record<number, string> = {
  400: 'Some of the information you entered is not valid.',
  401: 'You need to sign in to continue.',
  403: 'You are not allowed to do that.',
  409: 'That value is already in use.',
  429: 'Too many attempts. Please wait a moment and try again.',
};

/** Prefers the server's own message; falls back to a friendly one by status code. */
export function getApiErrorMessage(error: unknown, status: number): string {
  const body = error as Partial<ApiErrorBody> | undefined;
  if (typeof body?.message === 'string' && body.message.length > 0) {
    return body.message;
  }
  return STATUS_FALLBACKS[status] ?? 'Something went wrong. Please try again.';
}

/**
 * Thrown by `unwrap`/`assertOk` on failure. Extends `Error` so every
 * existing `error instanceof Error ? error.message : ...` catch site keeps
 * working unchanged, and additionally carries the response status plus the
 * standard error body's `code`/`details` (see `ErrorResponseDto`), which a
 * plain `Error` would otherwise discard — those are what let a component
 * react to `SLOT_UNAVAILABLE`, `SCHEDULE_CONFLICTS_WITH_BOOKINGS`, etc.
 * without parsing `message` text.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** The stable, machine-readable code a business-rule violation carries (e.g. `SLOT_UNAVAILABLE`), when present. */
export function getApiErrorCode(error: unknown): string | undefined {
  return error instanceof ApiError ? error.code : undefined;
}

/** The structured `details` some error codes carry (e.g. `SCHEDULE_CONFLICTS_WITH_BOOKINGS`'s affected appointments). */
export function getApiErrorDetails(error: unknown): unknown {
  return error instanceof ApiError ? error.details : undefined;
}

function toApiError(result: { error?: unknown; response: Response }): ApiError {
  const body = result.error as Partial<ApiErrorBody> | undefined;
  return new ApiError(
    getApiErrorMessage(result.error, result.response.status),
    result.response.status,
    body?.code,
    body?.details,
  );
}

/**
 * Unwraps an openapi-fetch result, throwing an `ApiError` on failure.
 * Checked via `response.ok`, not by narrowing on `data`/`error`: when an
 * operation has no documented error response, openapi-fetch's generated
 * `error` type is `never`, and narrowing on it collapses `response`'s type
 * too, which `response.ok` sidesteps entirely.
 */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (!result.response.ok || result.data === undefined) {
    throw toApiError(result);
  }
  return result.data;
}

/** Like `unwrap`, for calls whose success response has no body (204). */
export function assertOk(result: { error?: unknown; response: Response }): void {
  if (!result.response.ok) {
    throw toApiError(result);
  }
}
