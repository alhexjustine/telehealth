# Design

## Context

See proposal.md - Why. Relevant existing pieces this design builds on:

- `Appointment.status` already includes `COMPLETED` (set by
  `ConsultationsService.complete`), `BOOKED`, `CANCELLED`, `NOT_HELD`.
- `ClinicalAccessPolicy.assertCanPatientReadRecord` already gates the patient's own record read to
  `actor.role === PATIENT && actor.id === appointment.patientId && appointment.status === COMPLETED`
  — the account, not the dependent, since a dependent has no login.
- `hasTreatingRelationship(prisma, doctorId, patientId, dependentId)` answers a different question:
  "has this doctor ever had a booked/completed appointment with this specific person," used for the
  doctor's continuity-of-care patient-record view across the *whole relationship*.
- Admin actions that require a reason and are audited follow one recurring shape:
  `AdminUsersService.setStatus`/`DoctorReviewService`'s approve/reject — validate the reason length,
  apply the change, write the `AuditLog` row, all in one transaction; a same-status request is
  rejected `409` rather than silently no-op'd.

## Goals / Non-Goals

**Goals:**
- A review is anchored to one specific appointment, not to "doctor + patient" in the abstract, so a
  parent's visit and their child's visit with the same doctor are reviewed independently.
- Hiding a review is fully reversible and auditable, never a hard delete.
- The average rating shown to patients can never include a hidden review, with no caching window
  where a just-hidden review still counts.
- Rating stays informational: nothing here changes the deterministic specialty-matching algorithm
  or the default search sort.

**Non-Goals:**
- No reply/response mechanism for the doctor to answer a review.
- No "helpful/unhelpful" voting or any other engagement mechanic on reviews.
- No deleting one's own review in this pass (only overwrite via re-submission); revisit later if
  needed.
- No rate-limiting specific to review submission beyond what already exists at the HTTP layer.

## Decisions

- **Eligibility reuses `assertCanPatientReadRecord`'s predicate, not `hasTreatingRelationship`.**
  A review is scoped to one appointment (`appointmentId` unique on `DoctorReview`), so the question
  is "may this account read/act on *this* appointment's record," which is exactly what
  `assertCanPatientReadRecord` already answers. `hasTreatingRelationship` answers a broader
  question — "has this doctor ever treated this person at all" — used for the doctor's aggregate
  patient-record view, not for gating a single appointment's review. Reusing the narrower,
  already-tested predicate avoids inventing a second, subtly different access rule for the same
  underlying fact (own appointment, completed).

- **One row per appointment, upserted.** `DoctorReview.appointmentId` is `@unique`. "Once per
  appointment, editable" then falls out of `upsert` rather than a separate application-level
  uniqueness check plus a distinct "edit" code path — one write path, one place that can be wrong.
  Alternative considered: a separate `PATCH` "edit" endpoint distinct from `POST` "create" — rejected
  as unnecessary complexity when the record's identity (one per appointment) already makes them the
  same operation.

- **Aggregate rating computed on read, not maintained as a running counter on `DoctorProfile`.**
  A doctor's review count is small enough (bounded by their appointment volume) that
  `AVG(rating) WHERE hidden_at IS NULL` per doctor at query time is cheap, and it guarantees the
  average is always exactly consistent with the current hidden/visible state — no risk of a
  stored counter drifting from reality after a hide/unhide, and no additional write inside the
  hide/unhide transaction. Alternative considered: a denormalized `averageRating`/`reviewCount` on
  `DoctorProfile`, updated transactionally on every review write/hide/unhide — rejected: it
  duplicates data that's trivial to compute, and doubles the number of places a hide/unhide
  transaction must touch.

- **Rating sort is opt-in, never blended into the default sort or into specialty matching.**
  The brief's "deterministic specialty-matching rules... not a call to an external AI service"
  constraint is about the matching algorithm itself, and this feature doesn't touch it — but to
  keep that boundary unambiguous, rating is added purely as an *additional explicit sort a patient
  can choose*, exactly like the existing name/experience sorts, never as a hidden weight in the
  default "soonest slot" ordering or in guided symptom matching.

- **Reviewer identity is never shown in the public/patient-facing view, only to admins.** Reviews
  are feedback about a healthcare visit; showing "Jamie Lovelace rated Dr. X" to other patients
  needlessly links a stranger's name to their health-seeking behavior for no product benefit. The
  admin moderation view *does* show the reviewing account (needed to act on abuse, e.g. a pattern
  of harassment from one account) — this mirrors the existing rule that admins see account
  identities elsewhere (admin-users) but never clinical content; a review's rating/comment is
  feedback text, not clinical content, so showing it to an admin doesn't cross that line.

- **Hide/unhide both require a reason, mirroring `admin-users`' status-change rule rather than
  `admin-doctor-review`'s asymmetric approve(optional)/reject(required) split.** A review only has
  two states to move between (visible, hidden) and either transition is a discrete, reviewable
  administrator decision worth a reason in the audit trail — there's no "default happy path"
  transition here the way approval is for a doctor.

## Risks / Trade-offs

- [A patient could leave a harsh but honest review the doctor disputes] → Mitigation: the admin
  moderation queue exists precisely for this; hiding requires a stated reason, and unhiding is
  equally available, so it's a reversible editorial decision, not a silent removal.
- [Merge conflict with `add-doctor-favorites`, which also modifies `doctor-discovery`'s spec and
  likely the same doctor-card component/response DTO] → Mitigation: called out in proposal.md's
  Impact section; whichever change lands second rebases its `doctor-discovery` delta onto the
  other's already-archived spec by hand.
- [Computing the average with `AVG(...) WHERE hidden_at IS NULL` per doctor on every search-result
  page could be a per-row query in a naive implementation] → Mitigation: this is a straightforward
  `GROUP BY doctorId` aggregate joined once across the page of doctors being returned, the same
  shape as the existing "next available slot" computation already joined onto search results — not
  an N+1 pattern to begin with.

## Open Questions

- Whether a doctor should be able to see their own reviews' reviewer identity (not just rating/
  comment) is left for later — this pass keeps the doctor-facing view identical to the public one
  (rating + comment, no identity), which is the safer default and easy to loosen later without a
  spec change to the *public* view.
