import { describe, expect, it, jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { AppointmentStatus, Role, SessionState } from '../generated/prisma/enums.js';
import { DomainError } from '../common/errors/domain-error.js';
import { ErrorCode } from '../common/errors/error-codes.js';
import { ClinicalAccessPolicy, hasTreatingRelationship } from './clinical-access-policy.js';

const patientId = 'patient-1';
const doctorId = 'doctor-1';
const booked = { patientId, doctorId, status: AppointmentStatus.BOOKED };
const cancelled = { patientId, doctorId, status: AppointmentStatus.CANCELLED };
const completed = { patientId, doctorId, status: AppointmentStatus.COMPLETED };

function code(fn: () => void): string {
  try {
    fn();
  } catch (error) {
    if (error instanceof DomainError) return (error.getResponse() as { code: string }).code;
    throw error;
  }
  throw new Error('expected to throw');
}

describe('ClinicalAccessPolicy', () => {
  describe('assertCanViewWorkspace / canViewWorkspace', () => {
    it('Participant views the workspace', () => {
      expect(() =>
        ClinicalAccessPolicy.assertCanViewWorkspace({ id: patientId, role: Role.PATIENT }, booked),
      ).not.toThrow();
      expect(() =>
        ClinicalAccessPolicy.assertCanViewWorkspace({ id: doctorId, role: Role.DOCTOR }, booked),
      ).not.toThrow();
      expect(ClinicalAccessPolicy.canViewWorkspace({ id: patientId, role: Role.PATIENT }, booked)).toBe(true);
    });

    it('Non-participant denied', () => {
      expect(() =>
        ClinicalAccessPolicy.assertCanViewWorkspace({ id: 'someone-else', role: Role.PATIENT }, booked),
      ).toThrow(NotFoundException);
      expect(() =>
        ClinicalAccessPolicy.assertCanViewWorkspace({ id: 'someone-else', role: Role.DOCTOR }, booked),
      ).toThrow(NotFoundException);
      expect(ClinicalAccessPolicy.canViewWorkspace({ id: 'someone-else', role: Role.PATIENT }, booked)).toBe(false);
    });

    it('admin actor is denied as a defense-in-depth check (real 403 comes from @Roles)', () => {
      expect(() =>
        ClinicalAccessPolicy.assertCanViewWorkspace({ id: 'any-admin', role: Role.ADMIN }, booked),
      ).toThrow(NotFoundException);
    });

    it('Cancelled appointment', () => {
      expect(
        code(() => ClinicalAccessPolicy.assertCanViewWorkspace({ id: patientId, role: Role.PATIENT }, cancelled)),
      ).toBe(ErrorCode.APPOINTMENT_NOT_ACTIVE);
      expect(ClinicalAccessPolicy.canViewWorkspace({ id: patientId, role: Role.PATIENT }, cancelled)).toBe(false);
    });
  });

  describe('assertCanWriteRecord', () => {
    it('allows the doctor while JOINED or IN_PROGRESS', () => {
      expect(() =>
        ClinicalAccessPolicy.assertCanWriteRecord({ id: doctorId, role: Role.DOCTOR }, booked, SessionState.JOINED),
      ).not.toThrow();
      expect(() =>
        ClinicalAccessPolicy.assertCanWriteRecord(
          { id: doctorId, role: Role.DOCTOR },
          booked,
          SessionState.IN_PROGRESS,
        ),
      ).not.toThrow();
    });

    it('denies a non-doctor or another doctor (404)', () => {
      expect(() =>
        ClinicalAccessPolicy.assertCanWriteRecord({ id: patientId, role: Role.PATIENT }, booked, SessionState.JOINED),
      ).toThrow(NotFoundException);
      expect(() =>
        ClinicalAccessPolicy.assertCanWriteRecord(
          { id: 'another-doctor', role: Role.DOCTOR },
          booked,
          SessionState.JOINED,
        ),
      ).toThrow(NotFoundException);
    });

    it('locked once completed', () => {
      expect(
        code(() =>
          ClinicalAccessPolicy.assertCanWriteRecord(
            { id: doctorId, role: Role.DOCTOR },
            booked,
            SessionState.COMPLETED,
          ),
        ),
      ).toBe(ErrorCode.RECORD_LOCKED);
    });

    it('not active while only SCHEDULED', () => {
      expect(
        code(() =>
          ClinicalAccessPolicy.assertCanWriteRecord(
            { id: doctorId, role: Role.DOCTOR },
            booked,
            SessionState.SCHEDULED,
          ),
        ),
      ).toBe(ErrorCode.SESSION_NOT_ACTIVE);
    });
  });

  describe('assertCanPatientReadRecord', () => {
    it('allows the owning patient of a completed consultation', () => {
      expect(() =>
        ClinicalAccessPolicy.assertCanPatientReadRecord({ id: patientId, role: Role.PATIENT }, completed),
      ).not.toThrow();
    });

    it('denies a draft (not completed), another patient, and a doctor', () => {
      expect(() =>
        ClinicalAccessPolicy.assertCanPatientReadRecord({ id: patientId, role: Role.PATIENT }, booked),
      ).toThrow(NotFoundException);
      expect(() =>
        ClinicalAccessPolicy.assertCanPatientReadRecord({ id: 'someone-else', role: Role.PATIENT }, completed),
      ).toThrow(NotFoundException);
      expect(() =>
        ClinicalAccessPolicy.assertCanPatientReadRecord({ id: doctorId, role: Role.DOCTOR }, completed),
      ).toThrow(NotFoundException);
    });
  });

  describe('hasTreatingRelationship', () => {
    it('treating relationship with a booked or completed appointment', async () => {
      const countFn = jest.fn<(args: unknown) => Promise<number>>().mockResolvedValue(1);
      const prisma = { appointment: { count: countFn } };
      await expect(hasTreatingRelationship(prisma as never, doctorId, patientId)).resolves.toBe(true);
      expect(countFn).toHaveBeenCalledWith({
        where: {
          doctorId,
          patientId,
          dependentId: null,
          status: { in: [AppointmentStatus.BOOKED, AppointmentStatus.COMPLETED] },
        },
      });
    });

    it('no treating relationship when only a cancelled appointment exists', async () => {
      const countFn = jest.fn<(args: unknown) => Promise<number>>().mockResolvedValue(0);
      const prisma = { appointment: { count: countFn } };
      await expect(hasTreatingRelationship(prisma as never, doctorId, patientId)).resolves.toBe(false);
    });

    it('scopes to a specific dependent, not the account holder or another dependent', async () => {
      const countFn = jest.fn<(args: unknown) => Promise<number>>().mockResolvedValue(1);
      const prisma = { appointment: { count: countFn } };
      const dependentId = 'dep-1';
      await expect(hasTreatingRelationship(prisma as never, doctorId, patientId, dependentId)).resolves.toBe(true);
      expect(countFn).toHaveBeenCalledWith({
        where: {
          doctorId,
          patientId,
          dependentId,
          status: { in: [AppointmentStatus.BOOKED, AppointmentStatus.COMPLETED] },
        },
      });
    });
  });
});
