let timeZoneCache: Set<string> | null = null;

/**
 * `Intl.supportedValuesOf('timeZone')` omits `UTC` in some runtimes even
 * though `Intl.DateTimeFormat` accepts it, so it's added back explicitly.
 * Shared by the availability schedule validator and the admin dashboard's
 * `tz` query parameter (see design.md's "Dashboard queries": "validated
 * like availability time zones").
 */
export function isSupportedTimeZone(timezone: string): boolean {
  if (!timeZoneCache) {
    timeZoneCache = new Set([...Intl.supportedValuesOf('timeZone'), 'UTC']);
  }
  return timeZoneCache.has(timezone);
}
