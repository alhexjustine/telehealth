import { createApiClient } from 'api-client';

export const apiClient = createApiClient();

// GET /auth/me legitimately returns 401 when signed out — that's the query's
// normal "not signed in" result, not a dead session, so it's excluded here.
const SESSION_INDEPENDENT_PATHS = new Set([
  '/auth/me',
  '/auth/login',
  '/auth/register/patient',
  '/auth/register/doctor',
]);

type SessionEndedListener = () => void;
let sessionEndedListener: SessionEndedListener | undefined;

/**
 * Registers the single listener invoked when a protected call comes back 401
 * outside of sign-in/registration/`GET /auth/me` — i.e. a session that died
 * mid-use (expired, revoked, or the account was suspended). The composition
 * root (`App.tsx`) is the only place that both the router and this client are
 * available without a circular import, so it's the one that wires this up.
 */
export function onSessionEnded(listener: SessionEndedListener): void {
  sessionEndedListener = listener;
}

apiClient.use({
  onResponse({ request, response }) {
    if (response.status === 401) {
      const path = new URL(request.url).pathname.replace(/^\/api/, '');
      if (!SESSION_INDEPENDENT_PATHS.has(path)) {
        sessionEndedListener?.();
      }
    }
    return response;
  },
});
