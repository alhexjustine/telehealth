import type { Prisma } from '../generated/prisma/client.js';
import { AccountStatus, VerificationStatus } from '../generated/prisma/enums.js';

/**
 * The one rule for which doctors are visible to a signed-in caller: approved
 * verification status and an active account, or (when `callerId` is given)
 * the caller viewing their own profile regardless of status. Shared by
 * search, the doctor profile, slots, and matching so none of them can drift
 * from the others and leak a pending/rejected/suspended doctor. See
 * design.md's "Visible-doctor rule in one place".
 */
export function visibleDoctorWhere(callerId?: string): Prisma.DoctorProfileWhereInput {
  const approvedAndActive: Prisma.DoctorProfileWhereInput = {
    verificationStatus: VerificationStatus.APPROVED,
    user: { status: AccountStatus.ACTIVE },
  };
  if (!callerId) {
    return approvedAndActive;
  }
  return { OR: [approvedAndActive, { userId: callerId }] };
}

/**
 * Same rule, evaluated in memory for a single already-fetched profile (used
 * where a query already loaded the row and a second SQL round-trip would be
 * wasteful, e.g. the slots endpoint).
 */
export function isVisibleDoctor(params: {
  doctorId: string;
  verificationStatus: VerificationStatus;
  accountStatus: AccountStatus;
  callerId?: string;
}): boolean {
  const approvedAndActive =
    params.verificationStatus === VerificationStatus.APPROVED &&
    params.accountStatus === AccountStatus.ACTIVE;
  return approvedAndActive || params.doctorId === params.callerId;
}
