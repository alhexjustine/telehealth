import { describe, expect, it } from 'vitest';

/**
 * Every route file whose main (or an independent, data-dependent secondary)
 * query has been migrated to `QueryState` (`ui-resilience`'s "Loading,
 * empty, and error states"). If a file is removed from this list, or a
 * listed file no longer imports/uses `QueryState`, this test fails — that's
 * the point: it's a tripwire against a future edit silently reverting a
 * page back to ad-hoc `isPending`/`data &&` handling.
 *
 * Routes deliberately NOT listed here (with reasons — see the
 * `harden-core-journey` change's task 2.2 report):
 *  - `patient/home.tsx`, `doctor/home.tsx`'s own `useCurrentUser()` call,
 *    and every other role home/area page's `useCurrentUser()`: this is a
 *    shared, cross-cutting auth query that `RequireRoleLayout` already
 *    gates (it blocks on pending and redirects on failure), so by the time
 *    any role page itself renders, `useCurrentUser()` is guaranteed
 *    resolved with data — it is not that page's own "main query" needing
 *    loading/empty/error handling.
 *  - `patient/find-care.tsx`, `patient/book-appointment.tsx`, and
 *    `doctor/schedule.tsx`'s own secondary queries where the file below
 *    already covers the page's main query and the secondary one degrades
 *    gracefully (documented per-file in the task 2.2 report).
 *  - `public/landing.tsx`: already has its own bespoke, spec-tested
 *    ("Catalog unavailable") loading/error handling for the specializations
 *    catalog with copy `QueryState`'s generic error view can't reproduce
 *    without changing tested behavior; left as-is rather than risking a
 *    regression for a cosmetic refactor.
 *  - Routes with no data-fetching "main query" at all (pure forms/marketing
 *    pages), e.g. `auth/*`, `public/privacy.tsx`, `public/terms.tsx`.
 */
const MIGRATED_ROUTE_FILES = [
  // Patient
  'patient/home.tsx',
  'patient/appointments.tsx',
  'patient/appointment-detail.tsx',
  'patient/records.tsx',
  'patient/record-detail.tsx',
  'patient/profile.tsx',
  'patient/doctors.tsx',
  'patient/doctor-profile.tsx',
  'patient/find-care.tsx',
  'patient/book-appointment.tsx',
  // Doctor
  'doctor/home.tsx',
  'doctor/profile.tsx',
  'doctor/schedule.tsx',
  'doctor/appointments.tsx',
  'doctor/appointment-detail.tsx',
  'doctor/patient-record.tsx',
  // Admin
  'admin/dashboard.tsx',
  'admin/users.tsx',
  'admin/doctors.tsx',
  'admin/doctor-detail.tsx',
  'admin/appointments.tsx',
  'admin/audit.tsx',
  // Shared
  'notifications-page.tsx',
  'consultation/workspace.tsx',
] as const;

// Reads every route file's raw source at build/test time (a Vite-native
// import, so it needs no Node `fs` typings in the browser-targeted web
// package's tsconfig). Keyed relative to this file, matching the list above.
const routeSources = import.meta.glob<string>(
  ['./**/*.tsx', '!./**/*.test.tsx'],
  { query: '?raw', import: 'default', eager: true },
);

function sourceFor(relativePath: string): string {
  const key = `./${relativePath}`;
  const source = routeSources[key];
  if (source === undefined) {
    throw new Error(`Could not load source for route file "${relativePath}" (looked up "${key}")`);
  }
  return source;
}

describe('QueryState coverage', () => {
  it.each(MIGRATED_ROUTE_FILES)('%s uses QueryState for its main query', (relativePath) => {
    const source = sourceFor(relativePath);
    expect(source).toContain("from '@/components/query-state'");
    expect(source).toContain('<QueryState');
  });
});
