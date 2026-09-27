# Proposal

## Why

Today an administrator can reject a doctor whose verification status is already `APPROVED` — the
reject action's only guard is "not the same status twice" (`STATUS_UNCHANGED`), so `APPROVED ->
REJECTED` succeeds. That conflates two different admin actions: verification review (was this
doctor's fictional license and profile legitimate at signup) and account discipline (should this
already-verified doctor keep using the platform right now). The account-level status change
(suspend/deactivate, `admin-users` capability) already exists specifically for the second case,
including session revocation and, for deactivation, automatic cancellation of upcoming
appointments. Rejection should be reserved for the initial review decision so a doctor's
verification history stays a record of that one-time review, not a lever an admin can also pull
after approval.

## What Changes

- The reject action is only accepted while a doctor's verification status is `PENDING`. Attempting
  to reject an `APPROVED` doctor now fails with `409 INVALID_VERIFICATION_TRANSITION` instead of
  succeeding.
- Approve is unaffected: it stays valid from `PENDING` or `REJECTED` (re-review), guarded only by
  the existing `STATUS_UNCHANGED` no-op check.
- The admin console's doctor review page disables the Reject button whenever the doctor's
  verification status is not `PENDING` (previously only disabled when already `REJECTED`), and
  its dialog surfaces the new error.
- No change to suspend/deactivate: they remain the only way to pull an already-approved doctor out
  of active service, per the existing `admin-users` capability.
- No external SaaS/BaaS/runtime API is introduced; this only tightens an existing in-process
  business rule in the NestJS API and its React admin UI.

## Capabilities

### Modified Capabilities
- `admin-doctor-review`: the "Approve or reject" requirement now restricts reject to doctors
  currently `PENDING`, adds the `409 INVALID_VERIFICATION_TRANSITION` scenario, and the "Doctor
  review pages in the web app" requirement's reject action reflects the same restriction.

## Impact

- **Affected module:** Admin (doctor review). Patient and Doctor modules are unaffected — an
  approved doctor's visibility to patients is unchanged by this proposal; only the *path* an admin
  uses to remove that visibility later changes (suspend/deactivate instead of reject).
- **Code:** `apps/api/src/admin-doctors/admin-doctors.service.ts` (`decide()`/`reject()`),
  `apps/api/src/common/errors/error-codes.ts` (new code), `apps/api/src/admin-doctors/admin-doctors.controller.ts`
  (Swagger response docs), `apps/web/src/routes/admin/doctor-detail.tsx` (button disabled logic,
  error surfacing).
- **Tests:** `apps/api/test/admin-doctors.e2e-spec.ts` (new scenario + Swagger doc update), and
  any web unit test covering the doctor-detail page's button states.
- **Docs:** regenerate `packages/api-client` (new error response), no architecture-doc changes
  needed beyond what the spec delta already covers.
