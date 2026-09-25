import { describe, expect, it } from '@jest/globals';
import { requiresReReview } from './doctor-re-review.js';
import { VerificationStatus } from '../generated/prisma/enums.js';

const approved = {
  verificationStatus: VerificationStatus.APPROVED,
  licenseNumber: 'LIC-1',
  specializationIds: ['spec-1', 'spec-2'],
};

describe('requiresReReview', () => {
  it('License number change on an approved doctor requires re-review', () => {
    expect(requiresReReview(approved, { licenseNumber: 'LIC-2' })).toBe(true);
  });

  it('Adding a specialization on an approved doctor requires re-review', () => {
    expect(requiresReReview(approved, { specializationIds: ['spec-1', 'spec-2', 'spec-3'] })).toBe(true);
  });

  it('Resubmitting the same specialization set, reordered, does not require re-review', () => {
    expect(requiresReReview(approved, { specializationIds: ['spec-2', 'spec-1'] })).toBe(false);
  });

  it('Unrelated field changes do not require re-review', () => {
    expect(requiresReReview(approved, {})).toBe(false);
  });

  it('A pending or rejected doctor never needs re-review', () => {
    const pending = { ...approved, verificationStatus: VerificationStatus.PENDING };
    expect(requiresReReview(pending, { licenseNumber: 'LIC-2' })).toBe(false);
    const rejected = { ...approved, verificationStatus: VerificationStatus.REJECTED };
    expect(requiresReReview(rejected, { specializationIds: ['spec-9'] })).toBe(false);
  });
});
