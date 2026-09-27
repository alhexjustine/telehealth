# doctor-availability Specification

## Purpose
Lets doctors define when they are available for consultations, as a weekly schedule in their own
time zone plus time off, and turns that into the concrete bookable time slots that patients will
see.

## Requirements

### Requirement: Weekly schedule
A signed-in doctor SHALL be able to replace their weekly schedule in a single request. The request
consists of an IANA time zone and a list of working ranges, each with a weekday (Monday to Sunday)
and a start and end time of day in 15-minute steps. For each range, the end MUST be later than the
start on the same day, and the range MUST be at least as long as the doctor's consultation length.
Ranges on the same weekday MUST NOT overlap. An empty list SHALL be allowed and means the doctor
offers no slots. A schedule MUST NOT be saved when any of the doctor's upcoming `BOOKED`
appointments would no longer lie entirely within one of the new ranges (evaluated in the new
time zone). The rejection SHALL list the affected appointments.

#### Scenario: Save a valid schedule
- **WHEN** a doctor saves time zone `Asia/Manila` with Monday 09:00–12:00 and Monday 13:00–17:00
- **THEN** the response is `200` with exactly those ranges and that time zone, replacing any previous schedule

#### Scenario: Overlapping ranges
- **WHEN** a doctor saves Monday 09:00–12:00 and Monday 11:00–14:00
- **THEN** the response is `400` identifying the overlapping ranges, and the previous schedule is unchanged

#### Scenario: End not after start
- **WHEN** a doctor saves a range from 14:00 to 13:00, or a range whose start or end is not on a 15-minute step
- **THEN** the response is `400` and the previous schedule is unchanged

#### Scenario: Range shorter than consultation
- **WHEN** a doctor with a 45-minute consultation length saves a range from 09:00 to 09:30
- **THEN** the response is `400` stating that the range is shorter than one consultation

#### Scenario: Invalid time zone
- **WHEN** a doctor saves the time zone `Mars/Olympus`
- **THEN** the response is `400` naming the time zone field

#### Scenario: Non-doctor denied
- **WHEN** a signed-in patient or administrator tries to read or save a schedule through the doctor self-service availability endpoints
- **THEN** the response is `403`

#### Scenario: Signed-out denied
- **WHEN** an unauthenticated client calls the doctor self-service availability endpoints
- **THEN** the response is `401`

#### Scenario: Schedule change would orphan a booking
- **WHEN** a doctor with a booked appointment next Monday at 10:00 saves a schedule that no longer covers Monday mornings
- **THEN** the response is `409` with code `SCHEDULE_CONFLICTS_WITH_BOOKINGS` listing that appointment, and the previous schedule is unchanged

### Requirement: View own availability
A signed-in doctor SHALL be able to view their time zone, weekly schedule ranges (ordered by
weekday and start time), and their time off that ends in the future.

#### Scenario: Doctor views availability
- **WHEN** a doctor with a saved schedule and one upcoming time-off entry requests their availability
- **THEN** the response contains the time zone, the ordered ranges, and the upcoming time-off entry

#### Scenario: New doctor
- **WHEN** a doctor who has never saved a schedule requests their availability
- **THEN** the response contains an empty range list, no time off, and the default time zone `UTC`

### Requirement: Time off
A signed-in doctor SHALL be able to add time off as a start and end instant, with an optional
reason of at most 200 characters, and to delete their own time off. The end MUST be later than the
start, the end MUST be in the future, and one entry MUST NOT be longer than 90 days. Time off MUST
NOT be added when it overlaps any of the doctor's `BOOKED` appointments; the rejection SHALL list
the affected appointments.

#### Scenario: Add time off
- **WHEN** a doctor adds time off from next Monday 00:00 to next Wednesday 00:00 in their time zone with reason "Conference"
- **THEN** the response is `201` with the stored entry

#### Scenario: Invalid time off
- **WHEN** a doctor adds time off that ends before it starts, ends in the past, or is longer than 90 days
- **THEN** the response is `400` and nothing is stored

#### Scenario: Delete own time off
- **WHEN** a doctor deletes one of their own time-off entries
- **THEN** the response is `204` and the entry no longer affects their slots

#### Scenario: Another doctor's time off
- **WHEN** a doctor tries to delete a time-off entry belonging to a different doctor
- **THEN** the response is `404` and the entry is unchanged

#### Scenario: Time off over a booking
- **WHEN** a doctor adds time off covering a period in which they have a booked appointment
- **THEN** the response is `409` with code `SCHEDULE_CONFLICTS_WITH_BOOKINGS` listing that appointment, and nothing is stored

### Requirement: Available slot calculation
The system SHALL calculate a doctor's available slots for a requested time range as follows:
- For each calendar date in the doctor's time zone, and each schedule range on that weekday, the
  range's start and end local times are converted to instants. A local time that is skipped by a
  daylight-saving change moves forward to the first valid time after it; a local time that
  occurs twice uses its first occurrence.
- Consecutive slots of the doctor's consultation length, in real elapsed minutes, are laid out
  from the range's start instant, and a slot is included only if it ends at or before the range's
  end instant.
- Slots that overlap any time off are removed.
- Slots that overlap any of the doctor's `BOOKED` appointments are removed.
- Slots that start less than 60 minutes from now are removed.
- Slots SHALL be returned in chronological order as UTC instants, with a start and an end.

The requested range MUST be at most 31 days long, and its end MUST be after its start.

#### Scenario: Slots follow the schedule and consultation length
- **WHEN** a doctor with a 30-minute consultation length has a Monday 09:00–12:00 range, and slots are requested for a future Monday
- **THEN** exactly six slots are returned, starting at 09:00, 09:30, 10:00, 10:30, 11:00, and 11:30 doctor-local time

#### Scenario: Consultation length does not divide the range
- **WHEN** a doctor with a 45-minute consultation length has a Monday 09:00–12:00 range, and slots are requested for a future Monday
- **THEN** exactly four slots are returned, starting at 09:00, 09:45, 10:30, and 11:15 doctor-local time

#### Scenario: Time off removes overlapping slots
- **WHEN** the doctor above (30-minute length) has time off from 10:15 to 11:00 on that Monday
- **THEN** the 10:00 and 10:30 slots are not returned and the other four are

#### Scenario: Too-soon slots removed
- **WHEN** slots are requested for today and a slot would start 30 minutes from now
- **THEN** that slot is not returned, and a slot starting 90 minutes from now is returned

#### Scenario: Clocks spring forward
- **WHEN** a doctor in `America/New_York` with a 60-minute consultation length has a Sunday 01:00–04:00 range, and slots are requested for the Sunday the clocks jump from 02:00 to 03:00
- **THEN** exactly two slots are returned, starting at 01:00 and 03:00 local time, each lasting 60 real minutes

#### Scenario: Clocks fall back
- **WHEN** the same doctor has a Sunday 01:00–03:00 range, and slots are requested for the Sunday the clocks repeat 01:00–02:00
- **THEN** exactly three slots of 60 real minutes are returned: 01:00 before the change, 01:00 after the change, and 02:00 local time

#### Scenario: Invalid range
- **WHEN** slots are requested for a range longer than 31 days, or whose end is not after its start
- **THEN** the response is `400`

#### Scenario: Schedule changes apply immediately
- **WHEN** a doctor changes their consultation length or weekly schedule
- **THEN** the next slot request reflects the change

#### Scenario: Booked slot removed
- **WHEN** the doctor above (30-minute length) has a booked appointment at 10:00 that Monday
- **THEN** the 10:00 slot is not returned, and it is returned again once that appointment is cancelled

#### Scenario: Booking of a different length
- **WHEN** a doctor changes their consultation length from 30 to 45 minutes while holding a 30-minute booking at 09:00 on a Monday with a 09:00–12:00 range
- **THEN** slots are laid out from the range start and every slot overlapping 09:00–09:30 is removed, so the 09:00 slot is not returned and slots from 09:45 onwards are

### Requirement: Slot visibility
Signed-in users SHALL be able to request the slots of approved doctors. A doctor whose
verification status is not `APPROVED` MUST have their slots hidden from everyone except
themselves. A doctor who has turned off accepting bookings MUST also return no slots to anyone
other than themselves — they still see their own calculated slots for planning purposes.
Unauthenticated clients MUST NOT be able to request slots.

#### Scenario: Patient views an approved doctor's slots
- **WHEN** a signed-in patient requests slots for an approved doctor
- **THEN** the response is `200` with the calculated slots

#### Scenario: Unapproved doctor hidden
- **WHEN** a signed-in patient requests slots for a doctor whose status is pending or rejected, or for an ID that is not a doctor
- **THEN** the response is `404`

#### Scenario: Doctor previews own slots while pending
- **WHEN** a doctor with status pending requests their own slots
- **THEN** the response is `200` with their calculated slots

#### Scenario: Signed-out denied
- **WHEN** an unauthenticated client requests any doctor's slots
- **THEN** the response is `401`

#### Scenario: Slots hidden while not accepting bookings
- **WHEN** a signed-in patient requests slots for an approved doctor who has turned off accepting bookings
- **THEN** the response is `200` with an empty list of slots

#### Scenario: Doctor still previews own slots while not accepting bookings
- **WHEN** a doctor who has turned off accepting bookings requests their own slots
- **THEN** the response is `200` with their calculated slots, unaffected by the toggle

### Requirement: Schedule page in the web app
The doctor area SHALL include a schedule page with:
- a time-zone selector, defaulting to the browser's time zone before the first save
- a weekly editor for adding and removing ranges on each weekday, with inline errors for
  overlapping, reversed, or too-short ranges
- a time-off list with add and delete actions
- a preview of the doctor's slots for the next seven days, shown in the doctor's time zone

#### Scenario: Inline range errors
- **WHEN** a doctor enters overlapping ranges for the same weekday on the schedule page
- **THEN** the editor marks both ranges with an error and does not submit

#### Scenario: Preview updates after saving
- **WHEN** a doctor adds a range and saves
- **THEN** the slot preview refreshes and includes slots from the new range
