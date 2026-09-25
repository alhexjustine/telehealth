import type { ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

/**
 * The subset of `useQuery`'s return value `QueryState` needs. A real
 * `UseQueryResult` satisfies this structurally, and tests can hand-build one
 * without wiring a real `QueryClient`.
 */
export type QueryStateResult<T> = Pick<UseQueryResult<T, unknown>, 'status' | 'data' | 'error' | 'refetch'>;

interface QueryStateProps<T> {
  query: QueryStateResult<T>;
  /** Renders the loaded data. Also called with stale data during a failed background refresh. */
  children: (data: T) => ReactNode;
  /** A short noun phrase for this data, e.g. "appointments" — used in the default loading/error copy. */
  label: string;
  /** True when `data` should be treated as "nothing to show yet". */
  isEmpty?: (data: T) => boolean;
  /** Shown instead of `children` when `isEmpty(data)` is true. */
  empty?: ReactNode;
  /** Overrides the default loading placeholder. */
  loading?: ReactNode;
}

/**
 * Renders one of loading / error / empty / data for a TanStack Query result,
 * per the `ui-resilience` spec's "Loading, empty, and error states". Data
 * presence (`query.data !== undefined`), not `query.status`, decides between
 * the full error screen and the data view: a failed *background* refetch
 * still reports `status: 'error'` while leaving the previous `data` in
 * place (see `@tanstack/query-core`'s reducer — the `"error"` action never
 * clears `state.data`), so checking `data` first is what keeps stale data on
 * screen with a non-blocking notice instead of replacing it with an error.
 */
export function QueryState<T>({ query, children, label, isEmpty, empty, loading }: QueryStateProps<T>) {
  if (query.data === undefined) {
    if (query.status === 'error') {
      return <QueryErrorState error={query.error} label={label} onRetry={() => void query.refetch()} />;
    }
    return loading !== undefined ? <>{loading}</> : <DefaultLoading label={label} />;
  }

  const data = query.data;
  const backgroundRefreshFailed = query.status === 'error';

  if (isEmpty?.(data)) {
    return (
      <>
        {backgroundRefreshFailed && <BackgroundRefreshNotice label={label} onRetry={() => void query.refetch()} />}
        {empty}
      </>
    );
  }

  return (
    <>
      {backgroundRefreshFailed && <BackgroundRefreshNotice label={label} onRetry={() => void query.refetch()} />}
      {children(data)}
    </>
  );
}

function DefaultLoading({ label }: { label: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
      <span
        aria-hidden="true"
        className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
      />
      Loading {label}…
    </div>
  );
}

function QueryErrorState({ error, label, onRetry }: { error: unknown; label: string; onRetry: () => void }) {
  // `error` is an `ApiError` (see `lib/api-error.ts`'s `unwrap`) for any failed API call, whose
  // `.message` is already a plain-language message mapped from the response code/status; a raw
  // network failure (fetch itself rejecting, never reaching `unwrap`) still has a `.message`, just
  // a less friendly one, so this only falls back to generic copy for a non-`Error` throw.
  const message = error instanceof Error && error.message ? error.message : `Something went wrong loading ${label}.`;
  return (
    <Alert variant="destructive">
      <AlertTitle>Couldn&apos;t load {label}</AlertTitle>
      <AlertDescription>
        <p>{message}</p>
        <Button type="button" variant="outline" size="sm" className="mt-2" onClick={onRetry}>
          Try again
        </Button>
      </AlertDescription>
    </Alert>
  );
}

function BackgroundRefreshNotice({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
      <span>Couldn&apos;t refresh {label} just now. Showing the last loaded data.</span>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
