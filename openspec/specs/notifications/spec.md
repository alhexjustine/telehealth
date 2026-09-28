# notifications Specification

## Purpose
Keeps patients and doctors informed about their appointments through database-backed in-app
notifications and reminders, delivered live while they are signed in, without any external
messaging service.

## Requirements

### Requirement: Appointment event notifications
The system SHALL create notifications for appointment events, in the same database transaction
as the event:
- When a patient books, the doctor receives "New booking" and the patient receives "Booking
  confirmed".
- When a patient reschedules, the doctor receives "Appointment rescheduled" with the old and new
  times, and the patient receives "Reschedule confirmed".
- When either participant cancels, the other participant receives "Appointment cancelled" with
  who cancelled and the reason, if one was given.
Each notification SHALL include the appointment ID, its start time (and the previous start time
for reschedules), the other participant's display name, and a link to the appointment in the
recipient's role area. If the event fails, no notification MUST be created.

#### Scenario: Booking notifies both
- **WHEN** a patient books an appointment
- **THEN** the doctor has one unread "New booking" notification and the patient has one unread "Booking confirmed" notification, both referencing the appointment

#### Scenario: Reschedule notifies both
- **WHEN** a patient reschedules an appointment
- **THEN** the doctor receives "Appointment rescheduled" with the old and new start times, and the patient receives "Reschedule confirmed"

#### Scenario: Cancellation notifies the other participant
- **WHEN** a doctor cancels an appointment with the reason "Unexpected emergency"
- **THEN** the patient receives "Appointment cancelled" naming the doctor and the reason, and the doctor receives no notification for it

#### Scenario: Failed event creates nothing
- **WHEN** a booking is rejected, for example with `SLOT_UNAVAILABLE`
- **THEN** no notification is created for anyone

### Requirement: Upcoming appointment reminders
The system SHALL send a reminder to both participants of every `BOOKED` appointment 24 hours
before it starts, and again 1 hour before it starts. A reminder MUST be created at most once per
appointment, recipient, and window. It MUST NOT be created for appointments that are no longer
`BOOKED`. It MUST NOT be created for a window that had already begun when the appointment was
booked. Reminders SHALL be created within 5 minutes after their window begins.

#### Scenario: 24-hour reminder
- **WHEN** an appointment booked three days ago is 23 hours and 58 minutes away
- **THEN** both participants have exactly one "Starts in 24 hours" reminder for it

#### Scenario: 1-hour reminder
- **WHEN** an appointment is 58 minutes away
- **THEN** both participants have exactly one "Starts in 1 hour" reminder for it

#### Scenario: No duplicates
- **WHEN** the reminder job runs several times during the same window
- **THEN** each participant still has exactly one reminder for that window

#### Scenario: Cancelled appointment
- **WHEN** an appointment is cancelled before its reminder window begins
- **THEN** no reminder is created for it

#### Scenario: Short-notice booking
- **WHEN** an appointment is booked 3 hours before it starts
- **THEN** no 24-hour reminder is created, and the 1-hour reminder is still created

### Requirement: Reading notifications
A signed-in user SHALL be able to:
- list their own notifications, newest first and paginated, optionally only unread ones
- get their unread count
- mark one of their notifications as read
- mark all of them as read
Users MUST NOT be able to see or change another user's notifications.

#### Scenario: List own notifications
- **WHEN** a user with 3 notifications, 2 of them unread, lists their notifications with only unread selected
- **THEN** the 2 unread notifications are returned, newest first, and the unread count is 2

#### Scenario: Mark one read
- **WHEN** a user marks one of their unread notifications as read
- **THEN** it is returned with a read time, and the unread count decreases by one

#### Scenario: Mark all read
- **WHEN** a user marks all notifications as read
- **THEN** their unread count becomes 0, and other users' notifications are unaffected

#### Scenario: Another user's notification
- **WHEN** a user tries to mark a notification belonging to another user as read
- **THEN** the response is `404` and the notification is unchanged

#### Scenario: Signed-out denied
- **WHEN** an unauthenticated client lists notifications or requests the unread count
- **THEN** the response is `401`

### Requirement: Live delivery
While signed in, the web app SHALL receive the user's new notifications and their updated unread
count over a real-time connection on the application origin, without reloading, within 2 seconds
of the event's transaction committing. The connection MUST authenticate with the user's session
and MUST only ever receive that user's events. It MUST be disconnected when the session is signed
out, expires, or is revoked.

#### Scenario: Doctor sees a booking live
- **WHEN** a doctor is signed in with the web app open and a patient books with them
- **THEN** the doctor's unread badge increases and a toast shows the new booking without a page reload

#### Scenario: Unauthenticated connection rejected
- **WHEN** a client opens a real-time connection without a valid session cookie
- **THEN** the connection is refused

#### Scenario: Only own events
- **WHEN** two users are connected and a notification is created for one of them
- **THEN** only that user's connection receives it

#### Scenario: Disconnected on sign-out
- **WHEN** a user signs out, or signs out of all devices, while connected in another tab or browser
- **THEN** the affected connections are closed and no further events reach them

#### Scenario: Fallback without a live connection
- **WHEN** the real-time connection cannot be established
- **THEN** the web app still refreshes the unread count at least once per minute

### Requirement: Notifications in the web app
Every role layout SHALL show a notification bell with the unread count. The bell SHALL open a
dropdown with the 10 most recent notifications and a "mark all as read" action. Each notification
SHALL display its title, the relevant appointment time in the viewer's time zone, and how long
ago it arrived. Opening a notification SHALL mark it read and navigate to its link. Each role
area SHALL include a notifications page listing all notifications, with an unread filter.

#### Scenario: Open a notification
- **WHEN** a patient clicks an unread "Appointment cancelled" notification in the dropdown
- **THEN** it becomes read, the badge decreases, and the appointment detail page opens

#### Scenario: Empty state
- **WHEN** a user with no notifications opens the dropdown
- **THEN** a "You're all caught up" message is shown

### Requirement: Consultation outcome notification
When a doctor completes a consultation, the system SHALL notify the patient with "Consultation
summary available", in the same transaction as the completion. The notification links to the
record detail page.

#### Scenario: Patient notified on completion
- **WHEN** the doctor completes a consultation
- **THEN** the patient has one unread "Consultation summary available" notification linking to that record, and the doctor receives none

### Requirement: Verification decision notifications
When an administrator approves or rejects a doctor, the system SHALL notify that doctor in the
same transaction as the decision. An approval says the profile is now visible to patients. A
rejection includes the review note.

#### Scenario: Doctor notified of approval
- **WHEN** an administrator approves a pending doctor
- **THEN** the doctor has one unread "Profile approved" notification

#### Scenario: Doctor notified of rejection
- **WHEN** an administrator rejects a doctor with a note
- **THEN** the doctor has one unread "Profile not approved" notification containing the note

### Requirement: Administrative cancellation notifications
When an appointment is cancelled by an administrator, or because a participant's account was
deactivated, the system SHALL notify every participant whose account is still active, in the same
transaction. The notification states that the cancellation was made by the platform, and gives the
reason.

#### Scenario: Admin cancellation notifies both
- **WHEN** an administrator cancels an appointment with a reason
- **THEN** both the patient and the doctor receive "Appointment cancelled" stating it was cancelled by the platform, with the reason

#### Scenario: Deactivation notifies the counterpart only
- **WHEN** a doctor's account is deactivated and their upcoming appointments are cancelled
- **THEN** each affected patient is notified, and the deactivated doctor is not

### Requirement: Refill request notifications
When a patient requests a prescription refill, the system SHALL notify the treating doctor with
"Refill requested", in the same transaction as the request. When the doctor decides a refill
request, the system SHALL notify the requesting patient with "Refill request approved" or "Refill
request denied", including the doctor's note if one was given, in the same transaction as the
decision. Each notification SHALL link to the relevant record or refill-request queue entry.

#### Scenario: Doctor notified of a new request
- **WHEN** a patient requests a prescription refill
- **THEN** the treating doctor has one unread "Refill requested" notification linking to the request

#### Scenario: Patient notified of approval
- **WHEN** a doctor approves a refill request with a note
- **THEN** the patient has one unread "Refill request approved" notification containing that note

#### Scenario: Patient notified of denial
- **WHEN** a doctor denies a refill request
- **THEN** the patient has one unread "Refill request denied" notification

#### Scenario: Failed request creates nothing
- **WHEN** a refill request is rejected, for example with a duplicate-pending conflict
- **THEN** no notification is created for anyone
