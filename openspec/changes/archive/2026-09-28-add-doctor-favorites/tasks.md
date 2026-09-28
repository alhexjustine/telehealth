# Tasks

## 1. Data model

- [x] 1.1 Add `DoctorFavorite` model to `apps/api/prisma/schema.prisma` (`patientId` + `doctorId`,
      `@@unique([patientId, doctorId])`, `createdAt`; FKs to `PatientProfile`/`DoctorProfile` with
      `onDelete: Cascade`, mirroring `Dependent`'s shape) and generate the migration; verify
      `pnpm --filter api run prisma:generate` and the migration apply cleanly against a fresh
      `telehealth_test` database.
- [x] 1.2 Add `ErrorCode.FAVORITE_LIMIT_REACHED` to `apps/api/src/common/errors/error-codes.ts`.

## 2. Backend: favorites module

- [x] 2.1 Create `apps/api/src/favorites` (`FavoritesModule`, `FavoritesController` under
      `PATIENT`-only `/patients/me/favorites`, `FavoritesService`, DTOs), following
      `apps/api/src/dependents`'s module shape. Extract `DiscoveryService`'s per-doctor
      search-card-summary builder into a method the favorites service can reuse (design.md
      "Favorites-list entries are computed live").
- [x] 2.2 Implement `POST /patients/me/favorites` (favorite by `doctorId`): 201 on new favorite,
      200 no-op on an already-favorited doctor, 404 for a hidden doctor, 409
      `FAVORITE_LIMIT_REACHED` at 50, `@Roles(Role.PATIENT)` for the 403 case. Verify with e2e
      tests in `apps/api/test/favorites.e2e-spec.ts` named after their scenarios: "Favorite an
      approved doctor", "Favoriting again is a no-op", "Cannot favorite a hidden doctor",
      "Favorite limit reached", "Non-patient denied", "Signed-out denied".
- [x] 2.3 Implement `DELETE /patients/me/favorites/:doctorId` (idempotent unfavorite). Verify with
      e2e tests named "Unfavorite a favorited doctor", "Unfavoriting an unfavorited doctor is a
      no-op", "Signed-out denied".
- [x] 2.4 Implement `GET /patients/me/favorites` (list, each entry enriched via the shared summary
      builder, excluding doctors no longer approved/active). Verify with e2e tests named "List
      favorites with live summaries", "Favorite doctor no longer visible", "Empty favorites",
      "Signed-out denied".
- [x] 2.5 Add an e2e test named "Favoriting does not reorder search results" in
      `apps/api/test/favorites.e2e-spec.ts` (or alongside `discovery-search.e2e-spec.ts`) asserting
      a doctor search's order/inclusion/content is byte-for-byte identical before and after
      favoriting one of the returned doctors.
- [x] 2.6 Add Swagger decorators (`@ApiOkResponse`/`@ApiCreatedResponse({ type })`) to every new
      route per this repo's `@nestjs/swagger` gotcha, then run `pnpm --filter api run
      openapi:generate` and `pnpm openapi:generate` to regenerate `packages/api-client`; verify
      `pnpm --filter api run build` and `pnpm --filter web run typecheck` both pass against the
      regenerated client.

## 3. Web: favorites list and favorite toggle

- [x] 3.1 Add `apps/web/src/lib/favorites/use-favorites.ts` (`useFavorites`,
      `useFavoriteDoctor`, `useUnfavoriteDoctor`), following `use-dependents.ts`'s shape.
- [x] 3.2 Add a favorite-toggle control to `apps/web/src/routes/patient/doctors.tsx`'s search
      result cards and to `apps/web/src/routes/patient/doctor-profile.tsx`, driven by
      `useFavorites` membership lookup (design.md "Favorite state is not embedded..."). Verify with
      a test in `doctors.test.tsx` (or a new `doctor-profile.test.tsx` case) named "Favorite from a
      search result card".
- [x] 3.3 Add `apps/web/src/routes/patient/favorites.tsx` (My favorites page: doctor cards reusing
      `doctors.tsx`'s card layout, a "Book" link per card, an empty state) and a nav entry/route in
      `apps/web/src/router.tsx`. Verify with `favorites.test.tsx` covering "Unfavorite from My
      favorites", "Book from My favorites skips search", and the empty-favorites state.
- [x] 3.4 Add the new route file to `query-state-coverage.test.ts`'s tracked list (its main
      favorites query uses `QueryState`).

## 4. Web: Book again with attendee prefill

- [x] 4.1 Add a "Book again" link to each appointment row in
      `apps/web/src/routes/patient/appointments.tsx`, linking to
      `/patient/doctors/{doctor.id}?dependent={dependent?.id ?? ''}`. Verify with a test named
      "Book again preselects the same attendee" asserting the link's `href` carries the
      appointment's `dependent.id` when present.
- [x] 4.2 Make `apps/web/src/routes/patient/doctor-profile.tsx` read an optional `?dependent=`
      search param and carry it through into the per-slot "Book" link it already builds (alongside
      the existing `symptoms` param).
- [x] 4.3 Make `apps/web/src/routes/patient/book-appointment.tsx` read `?dependent=` and use it to
      initialize `dependentId` state, falling back to `''` (the account holder) when the ID doesn't
      match any of `useDependents()`'s current items (design.md's "Risks/Trade-offs" validation
      note). Verify with tests named "Book again preselects the same attendee" (a dependent ID is
      preselected) and "Book again for the account holder" (no `?dependent=` preselects "Myself").
- [x] 4.4 Verify "Book again with a doctor no longer accepting bookings" and "Book again with a
      doctor no longer visible" are already covered by existing doctor-profile behavior (no new
      code expected — `usePublicDoctorProfile`'s existing hidden-doctor/not-accepting handling
      applies regardless of how the profile page was reached); add a `doctor-profile.test.tsx` case
      for each if not already covered, asserting no `add-doctor-favorites`-specific handling is
      required.

## 5. Documentation and traceability

- [x] 5.1 Update `docs/modules/patient.md`'s feature list and data model with favorites and "Book
      again"; verify `pnpm docs:build` succeeds.
- [x] 5.2 Run `pnpm --filter api run lint`, `pnpm --filter api run typecheck`, `pnpm --filter api
      run test`, `pnpm --filter api run test:e2e`, `pnpm --filter web run lint`, `pnpm --filter web
      run typecheck`, `pnpm --filter web run test`, and `pnpm traceability`; verify all pass.
