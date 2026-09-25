# Proposal

## Why

Patients can only book a consultation at a time the doctor has actually offered. Before discovery
and booking can exist, doctors need a way to say when they work, block out time off, and have the
system turn that into concrete bookable time slots. The brief requires availability stored and
enforced by the application, with no external calendar service.

## What Changes

- Doctors set a weekly schedule: one or more working time ranges for each weekday, in their own
  time zone. The whole schedule is saved at once.
- Doctors add and remove time off: specific date-time ranges during which no slots are offered.
- The API calculates available slots for a doctor over a date range. It uses the weekly
  schedule, the doctor's consultation length (already on the doctor profile), and time off, and
  removes slots that start too soon to book. Times are calculated correctly across daylight-saving
  changes.
- Slots of doctors who aren't yet approved are hidden from everyone except the doctor, who can
  preview their own schedule while waiting for verification.
- Web: a doctor schedule page with a weekly range editor, time-zone selection, time-off
  management, and a preview of the next seven days of slots.
- Documentation: the Doctor module page (availability), L3 components, and the regenerated data
  model.

Booked appointments do not exist yet. `add-appointment-booking` will change slot calculation to
exclude booked times, and will protect existing bookings when schedules change.

No external SaaS, BaaS, calendar, or scheduling service is introduced. The new dependencies are
open-source date and time-zone libraries.

**Product modules affected:** Doctor (schedule management). Patient is only indirectly affected:
the slot listing is what the discovery and booking changes will show to patients.

## Capabilities

### New Capabilities
- `doctor-availability`: A doctor's weekly schedule, time zone, and time off; the calculation of
  available slots; and who may see a doctor's slots.

### Modified Capabilities
<!-- None. doctor-profile already owns the consultation length this change reads. -->

## Impact

- API: a new `availability` module. Endpoints under `/api/doctors/me/availability` (doctor only)
  and `GET /api/doctors/{doctorId}/slots` (signed-in users).
- Database: new `availability_rules` and `availability_exceptions` tables, and a `timezone`
  column on `doctor_profiles`.
- Dependencies: `date-fns` v4 and `@date-fns/tz` in `apps/api` and `apps/web`.
- Web: a new `/doctor/schedule` page and a doctor navigation entry.
- The generated API client and the docs are regenerated.
