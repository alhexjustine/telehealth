import { VerificationStatus } from '../generated/prisma/enums.js';

export interface DoctorCredentials {
  verificationStatus: VerificationStatus;
  licenseNumber: string;
  specializationIds: string[];
}

export interface DoctorCredentialChanges {
  licenseNumber?: string;
  specializationIds?: string[];
}

/**
 * Whether a doctor's self-update must send them back to `PENDING` review: an
 * `APPROVED` doctor's license number or specialization set is what
 * `add-admin-console`'s review actually verified, so changing either
 * invalidates that approval (see the `doctor-profile` spec's "Credential
 * change triggers re-review"). Any other field (bio, years of experience,
 * consultation length, names) doesn't affect it. Specialization sets are
 * compared unordered — resubmitting the same set in a different order isn't
 * a change.
 */
export function requiresReReview(current: DoctorCredentials, changes: DoctorCredentialChanges): boolean {
  if (current.verificationStatus !== VerificationStatus.APPROVED) {
    return false;
  }

  const licenseChanged = changes.licenseNumber !== undefined && changes.licenseNumber !== current.licenseNumber;
  const specializationsChanged =
    changes.specializationIds !== undefined && !sameIdSet(changes.specializationIds, current.specializationIds);

  return licenseChanged || specializationsChanged;
}

function sameIdSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((id) => setB.has(id));
}
