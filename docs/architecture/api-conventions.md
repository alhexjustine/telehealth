# API Conventions

Cross-cutting conventions every endpoint follows, introduced in `setup-foundation` and extended
with a machine-readable error `code` in `add-appointment-booking`.

## Error response shape

Every API error — validation failure, an unhandled exception, a database constraint violation, or
a business-rule rejection — is JSON with the same base shape (`GlobalExceptionFilter`,
`apps/api/src/common/filters/global-exception.filter.ts`):

```jsonc
{
  "statusCode": 409,
  "error": "Conflict",
  "message": "That slot is no longer available.",
  "requestId": "6d9e...", // also echoed as the X-Request-Id response header
  "code": "SLOT_UNAVAILABLE", // optional: present for business-rule violations
  "details": {
    /* optional: extra structure for some codes, see below */
  },
  "errors": [
    /* optional: field-indexed validation errors, e.g. from the schedule validator */
  ]
}
```

`code` is never inferred from `message` text (message wording can change; `code` is contractual)
and never fabricated for an exception that didn't declare one — a plain `NotFoundException` or an
unexpected `500` has no `code` field at all. No response body ever includes a stack trace or raw
database error text; see [Authentication & Authorization](/architecture/auth) for how account and
session errors specifically stay generic.

The generated API client (`packages/api-client`) exports `getApiErrorCode`/`getApiErrorDetails`
helpers, and the web app's `unwrap`/`assertOk` (`apps/web/src/lib/api-error.ts`) throw an
`ApiError` that carries `code`/`details` through to the component that catches it — so the UI can
switch on `code` (e.g. show a "slot taken" message and refresh the slot picker) instead of parsing
`message`.

## Error code catalogue

Stable across releases — once shipped, a code is never renamed or repurposed.

| Code                                | Status | Meaning                                                                 |
| ------------------------------------ | :----: | ------------------------------------------------------------------------ |
| `PROFILE_INCOMPLETE`                 |  409   | The patient's profile is missing a required field                       |
| `SLOT_UNAVAILABLE`                   |  409   | The requested start/end no longer matches an available slot             |
| `BEYOND_BOOKING_HORIZON`             |  409   | The requested start is more than 60 days ahead                          |
| `BOOKING_LIMIT_REACHED`              |  409   | The patient already has 5 upcoming booked appointments                  |
| `PATIENT_CONFLICT`                   |  409   | The requested time overlaps another of the patient's own appointments   |
| `RESCHEDULE_WINDOW_CLOSED`           |  409   | Less than 2 hours remain before the appointment being rescheduled starts |
| `APPOINTMENT_NOT_CANCELLABLE`        |  409   | The appointment already started, or its status isn't `BOOKED`           |
| `SCHEDULE_CONFLICTS_WITH_BOOKINGS`   |  409   | A schedule save or time-off add would orphan a `BOOKED` appointment      |

`SCHEDULE_CONFLICTS_WITH_BOOKINGS`'s `details` lists the affected appointments:

```jsonc
{
  "code": "SCHEDULE_CONFLICTS_WITH_BOOKINGS",
  "details": {
    "appointments": [
      { "id": "...", "startsAt": "2026-10-05T09:00:00.000Z", "endsAt": "2026-10-05T09:30:00.000Z", "patientName": "Ada Lovelace" }
    ]
  }
}
```

## Database constraint violations

A uniqueness or exclusion constraint violated directly at the database layer (bypassing a
service's own pre-checks — the scenario the appointment-overlap exclusion constraints guard
against, see [Patient](/modules/patient#booking-an-appointment)) is reported as a generic `409`
with no `code`, unless the service that triggered it catches the specific constraint and rethrows
a `DomainError` with one (as `AppointmentsService` does for the two overlap constraints). See
[Data Model](/architecture/data-model) for the constraints themselves.
