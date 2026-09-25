# Proposal

## Why

The platform needs an operator. Someone has to approve doctors before patients can see them,
handle problem accounts, step in on invalid or stuck appointments, see how the service is being
used, and account for every privileged action. The brief requires an Admin module with user
management, doctor profile review, appointment oversight, an operational dashboard, and an audit
log, all application-managed.

## What Changes

- **User management:**
  - Search patient and doctor accounts.
  - Activate, suspend, or deactivate an account, with a required reason. Suspending or
    deactivating revokes the account's sessions immediately. Deactivating also cancels the
    account's upcoming appointments and notifies the other participants.
  - Admin accounts cannot be changed through the console.
- **Doctor profile review:**
  - A review queue by verification status, with the full profile including email and license.
  - Approve, or reject with a required note; the doctor is notified either way.
  - Edit a doctor's profile and specializations.
  - An approved doctor who changes their license number or specializations returns to pending
    review.
- **Appointment oversight:**
  - List and filter all appointments with their consultation state. Admins never see clinical
    content.
  - Flag invalid bookings: past appointments that were never completed, and upcoming
    appointments with a doctor who is no longer visible.
  - Cancel an appointment with a required reason; both participants are notified.
  - Mark a past, uncompleted appointment as "not held".
- **Operational dashboard:** counts computed from the database for users, doctors, appointments,
  and consultation states, plus open work (pending reviews, invalid bookings) and a 14-day
  appointment trend.
- **Audit log:**
  - Every admin action and admin sign-in is recorded in the same transaction as the action.
    Each entry records actor, action, affected record, reason, before and after values, request
    ID, IP, and time.
  - Entries can't be changed or deleted, which the database enforces.
  - A filterable viewer shows each entry's changes.
- **Web:** the admin area with dashboard, users, doctor reviews, appointments, and audit log
  pages.
- **Documentation:** the Admin module page, the audit design, L3 components, and the regenerated
  data model.

No external SaaS, BaaS, verification, or analytics service is introduced. No new runtime
dependencies are expected; the dashboard chart is plain SVG.

**Product modules affected:** Admin (all of it). Doctor is affected by review outcomes and the
re-review rule. Patient and Doctor are both affected by status changes and admin cancellations.

## Capabilities

### New Capabilities
- `admin-users`: Searching accounts and changing account status, with its side effects.
- `admin-doctor-review`: The review queue, approval, rejection, and admin edits of doctor
  profiles.
- `admin-appointments`: Overseeing all appointments, flagging invalid bookings, admin
  cancellation, and marking appointments as not held.
- `admin-dashboard`: The operational counts and trend.
- `audit-log`: Recording and viewing privileged actions, and making the log immutable.

### Modified Capabilities
- `doctor-profile`: An approved doctor who changes their license number or specializations
  returns to `PENDING` review.
- `notifications`: Adds notifications for verification decisions and for appointments cancelled
  by an administrator or by account deactivation.

## Impact

- API: a new `admin` module (all routes `@Roles(ADMIN)`) and an `audit` module. The session
  service's revoke-all is used by status changes. The appointment cancellation logic is shared
  with admin cancellation. The doctor profile service applies the re-review rule. The auth
  service writes the admin sign-in audit entry.
- Database: a new `audit_logs` table with a trigger blocking UPDATE and DELETE, a `NOT_HELD`
  appointment status, and new notification types.
- Web: `/admin`, `/admin/users`, `/admin/doctors`, `/admin/doctors/:doctorId`,
  `/admin/appointments`, and `/admin/audit`.
- The generated API client and the docs are regenerated.
