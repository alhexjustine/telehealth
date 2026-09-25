const SESSION_ENDED_KEY = 'telehealth:session-ended';

/**
 * Marks that the user is about to be redirected to sign-in because their
 * session died mid-use (expired, revoked, or the account was suspended) —
 * see the `ui-resilience` spec's "Session-ended experience". `sessionStorage`
 * (not a query param) survives the `router.navigate()` redirect without
 * showing up in the URL, and is naturally scoped to this tab.
 */
export function markSessionEnded(): void {
  try {
    sessionStorage.setItem(SESSION_ENDED_KEY, 'true');
  } catch {
    // Storage can throw in a locked-down environment (private browsing, disabled site data);
    // the sign-in page simply won't show the message, which is an acceptable degradation.
  }
}

/**
 * Reads and clears the flag in one step, so the message is shown exactly
 * once — a page refresh on the sign-in page afterward won't repeat it.
 */
export function consumeSessionEnded(): boolean {
  try {
    const value = sessionStorage.getItem(SESSION_ENDED_KEY);
    if (value === 'true') {
      sessionStorage.removeItem(SESSION_ENDED_KEY);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
