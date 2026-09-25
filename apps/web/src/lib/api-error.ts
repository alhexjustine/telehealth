export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message: string;
  requestId: string;
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
 * Unwraps an openapi-fetch result, throwing a friendly `Error` on failure.
 * Checked via `response.ok`, not by narrowing on `data`/`error`: when an
 * operation has no documented error response, openapi-fetch's generated
 * `error` type is `never`, and narrowing on it collapses `response`'s type
 * too, which `response.ok` sidesteps entirely.
 */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (!result.response.ok || result.data === undefined) {
    throw new Error(getApiErrorMessage(result.error, result.response.status));
  }
  return result.data;
}

/** Like `unwrap`, for calls whose success response has no body (204). */
export function assertOk(result: { error?: unknown; response: Response }): void {
  if (!result.response.ok) {
    throw new Error(getApiErrorMessage(result.error, result.response.status));
  }
}
