import { describe, expect, it } from '@jest/globals';
import { AppointmentStatus, Role, SessionState } from '../generated/prisma/enums.js';
import { ErrorCode } from '../common/errors/error-codes.js';
import { DomainError } from '../common/errors/domain-error.js';
import {
  JOIN_CLOSES_AFTER_MINUTES,
  JOIN_OPENS_BEFORE_MINUTES,
  SCHEDULED_SESSION_STATE,
  transition,
  type ConsultationSessionState,
} from './consultation-state.js';

const startsAt = new Date('2026-01-01T10:00:00.000Z');
const endsAt = new Date('2026-01-01T10:30:00.000Z');
const bookedAppointment = { startsAt, endsAt, status: AppointmentStatus.BOOKED };

function minutesFromStart(minutes: number): Date {
  return new Date(startsAt.getTime() + minutes * 60_000);
}

function minutesFromEnd(minutes: number): Date {
  return new Date(endsAt.getTime() + minutes * 60_000);
}

function domainCode(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    if (error instanceof DomainError) {
      return (error.getResponse() as { code: string }).code;
    }
    throw error;
  }
  throw new Error('Expected transition to throw');
}

describe('transition', () => {
  describe('join', () => {
    it('Join within the window', () => {
      const result = transition({
        action: 'join',
        actorRole: Role.PATIENT,
        now: minutesFromStart(-10),
        appointment: bookedAppointment,
        session: SCHEDULED_SESSION_STATE,
      });
      expect(result.state).toBe(SessionState.JOINED);
      expect(result.patientJoinedAt).toEqual(minutesFromStart(-10));
      expect(result.doctorJoinedAt).toBeNull();
    });

    it('Too early or too late', () => {
      expect(
        domainCode(() =>
          transition({
            action: 'join',
            actorRole: Role.PATIENT,
            now: minutesFromStart(-20),
            appointment: bookedAppointment,
            session: SCHEDULED_SESSION_STATE,
          }),
        ),
      ).toBe(ErrorCode.OUTSIDE_JOIN_WINDOW);

      expect(
        domainCode(() =>
          transition({
            action: 'join',
            actorRole: Role.PATIENT,
            now: minutesFromEnd(31),
            appointment: bookedAppointment,
            session: SCHEDULED_SESSION_STATE,
          }),
        ),
      ).toBe(ErrorCode.OUTSIDE_JOIN_WINDOW);
    });

    it('accepts the exact window edges (-15m and +30m)', () => {
      expect(JOIN_OPENS_BEFORE_MINUTES).toBe(15);
      expect(JOIN_CLOSES_AFTER_MINUTES).toBe(30);

      const atOpen = transition({
        action: 'join',
        actorRole: Role.PATIENT,
        now: minutesFromStart(-JOIN_OPENS_BEFORE_MINUTES),
        appointment: bookedAppointment,
        session: SCHEDULED_SESSION_STATE,
      });
      expect(atOpen.state).toBe(SessionState.JOINED);

      const atClose = transition({
        action: 'join',
        actorRole: Role.DOCTOR,
        now: minutesFromEnd(JOIN_CLOSES_AFTER_MINUTES),
        appointment: bookedAppointment,
        session: SCHEDULED_SESSION_STATE,
      });
      expect(atClose.state).toBe(SessionState.JOINED);

      // One millisecond outside either edge is rejected.
      expect(() =>
        transition({
          action: 'join',
          actorRole: Role.PATIENT,
          now: new Date(minutesFromStart(-JOIN_OPENS_BEFORE_MINUTES).getTime() - 1),
          appointment: bookedAppointment,
          session: SCHEDULED_SESSION_STATE,
        }),
      ).toThrow(DomainError);
      expect(() =>
        transition({
          action: 'join',
          actorRole: Role.DOCTOR,
          now: new Date(minutesFromEnd(JOIN_CLOSES_AFTER_MINUTES).getTime() + 1),
          appointment: bookedAppointment,
          session: SCHEDULED_SESSION_STATE,
        }),
      ).toThrow(DomainError);
    });

    it('skipJoinWindowCheck bypasses the window (testing-only escape hatch)', () => {
      const result = transition({
        action: 'join',
        actorRole: Role.PATIENT,
        now: minutesFromStart(-20), // well outside the window; would otherwise throw
        appointment: bookedAppointment,
        session: SCHEDULED_SESSION_STATE,
        skipJoinWindowCheck: true,
      });
      expect(result.state).toBe(SessionState.JOINED);
    });

    it('Rejoin', () => {
      const firstJoin = minutesFromStart(-10);
      const alreadyJoined: ConsultationSessionState = {
        state: SessionState.JOINED,
        patientJoinedAt: firstJoin,
        doctorJoinedAt: null,
        startedAt: null,
        completedAt: null,
      };

      const result = transition({
        action: 'join',
        actorRole: Role.PATIENT,
        now: minutesFromStart(-5),
        appointment: bookedAppointment,
        session: alreadyJoined,
      });

      expect(result.state).toBe(SessionState.JOINED);
      expect(result.patientJoinedAt).toEqual(firstJoin);
    });

    it('rejects joining a cancelled appointment', () => {
      expect(
        domainCode(() =>
          transition({
            action: 'join',
            actorRole: Role.PATIENT,
            now: minutesFromStart(-10),
            appointment: { ...bookedAppointment, status: AppointmentStatus.CANCELLED },
            session: SCHEDULED_SESSION_STATE,
          }),
        ),
      ).toBe(ErrorCode.APPOINTMENT_NOT_ACTIVE);
    });
  });

  describe('start', () => {
    const patientJoined: ConsultationSessionState = {
      state: SessionState.JOINED,
      patientJoinedAt: minutesFromStart(-10),
      doctorJoinedAt: minutesFromStart(-2),
      startedAt: null,
      completedAt: null,
    };

    it('Doctor starts after the patient joins', () => {
      const now = minutesFromStart(0);
      const result = transition({
        action: 'start',
        actorRole: Role.DOCTOR,
        now,
        appointment: bookedAppointment,
        session: patientJoined,
      });
      expect(result.state).toBe(SessionState.IN_PROGRESS);
      expect(result.startedAt).toEqual(now);
    });

    it('Patient not yet joined', () => {
      const noPatientYet: ConsultationSessionState = { ...patientJoined, patientJoinedAt: null };
      expect(
        domainCode(() =>
          transition({
            action: 'start',
            actorRole: Role.DOCTOR,
            now: minutesFromStart(0),
            appointment: bookedAppointment,
            session: noPatientYet,
          }),
        ),
      ).toBe(ErrorCode.PATIENT_NOT_JOINED);

      // Also true when nobody has joined at all.
      expect(
        domainCode(() =>
          transition({
            action: 'start',
            actorRole: Role.DOCTOR,
            now: minutesFromStart(0),
            appointment: bookedAppointment,
            session: SCHEDULED_SESSION_STATE,
          }),
        ),
      ).toBe(ErrorCode.PATIENT_NOT_JOINED);
    });

    it('Invalid transition (start a completed consultation)', () => {
      const completed: ConsultationSessionState = {
        ...patientJoined,
        state: SessionState.COMPLETED,
        startedAt: minutesFromStart(0),
        completedAt: minutesFromStart(20),
      };
      expect(
        domainCode(() =>
          transition({
            action: 'start',
            actorRole: Role.DOCTOR,
            now: minutesFromStart(25),
            appointment: bookedAppointment,
            session: completed,
          }),
        ),
      ).toBe(ErrorCode.INVALID_SESSION_TRANSITION);
    });

    it('Patient cannot control the session (start)', () => {
      expect(() =>
        transition({
          action: 'start',
          actorRole: Role.PATIENT,
          now: minutesFromStart(0),
          appointment: bookedAppointment,
          session: patientJoined,
        }),
      ).toThrow('Only the doctor can start a consultation.');
    });
  });

  describe('complete', () => {
    const inProgress: ConsultationSessionState = {
      state: SessionState.IN_PROGRESS,
      patientJoinedAt: minutesFromStart(-10),
      doctorJoinedAt: minutesFromStart(-2),
      startedAt: minutesFromStart(0),
      completedAt: null,
    };

    it('Complete with summary', () => {
      const now = minutesFromStart(20);
      const result = transition({
        action: 'complete',
        actorRole: Role.DOCTOR,
        now,
        appointment: bookedAppointment,
        session: inProgress,
        hasPatientSummary: true,
      });
      expect(result.state).toBe(SessionState.COMPLETED);
      expect(result.completedAt).toEqual(now);
    });

    it('Complete without summary', () => {
      expect(
        domainCode(() =>
          transition({
            action: 'complete',
            actorRole: Role.DOCTOR,
            now: minutesFromStart(20),
            appointment: bookedAppointment,
            session: inProgress,
            hasPatientSummary: false,
          }),
        ),
      ).toBe(ErrorCode.SUMMARY_REQUIRED);
    });

    it('Invalid transition (complete one that is only JOINED)', () => {
      const joinedOnly: ConsultationSessionState = { ...inProgress, state: SessionState.JOINED, startedAt: null };
      expect(
        domainCode(() =>
          transition({
            action: 'complete',
            actorRole: Role.DOCTOR,
            now: minutesFromStart(5),
            appointment: bookedAppointment,
            session: joinedOnly,
            hasPatientSummary: true,
          }),
        ),
      ).toBe(ErrorCode.INVALID_SESSION_TRANSITION);
    });

    it('Patient cannot control the session (complete)', () => {
      expect(() =>
        transition({
          action: 'complete',
          actorRole: Role.PATIENT,
          now: minutesFromStart(20),
          appointment: bookedAppointment,
          session: inProgress,
          hasPatientSummary: true,
        }),
      ).toThrow('Only the doctor can complete a consultation.');
    });
  });
});
