import { ForbiddenException, HttpStatus } from '@nestjs/common';
import { AppointmentStatus, Role, SessionState } from '../generated/prisma/enums.js';
import { DomainError } from '../common/errors/domain-error.js';
import { ErrorCode } from '../common/errors/error-codes.js';

/** A participant may join starting this many minutes before the appointment starts. */
export const JOIN_OPENS_BEFORE_MINUTES = 15;
/** A participant may join until this many minutes after the appointment ends. */
export const JOIN_CLOSES_AFTER_MINUTES = 30;

export type ConsultationAction = 'join' | 'start' | 'complete';

/** The consultation-session fields the pure state machine reads and returns. A missing DB row is `SCHEDULED` with every timestamp `null`. */
export interface ConsultationSessionState {
  state: SessionState;
  patientJoinedAt: Date | null;
  doctorJoinedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
}

export const SCHEDULED_SESSION_STATE: ConsultationSessionState = {
  state: SessionState.SCHEDULED,
  patientJoinedAt: null,
  doctorJoinedAt: null,
  startedAt: null,
  completedAt: null,
};

export interface TransitionParams {
  action: ConsultationAction;
  /** The role of the participant performing the action — never a third party; identity/participation is checked by the caller before this runs. */
  actorRole: Role;
  now: Date;
  appointment: { startsAt: Date; endsAt: Date; status: AppointmentStatus };
  session: ConsultationSessionState;
  /** Required for `complete`: whether the consultation note currently has a non-blank patient summary. */
  hasPatientSummary?: boolean;
  /** Testing-only: when true, `join` skips the `[-15m, +30m]` window check (see `JOIN_WINDOW_DISABLED`). */
  skipJoinWindowCheck?: boolean;
}

/**
 * The single place every consultation-session state change is decided (see
 * design.md's "State machine"). Pure: takes already-loaded state and returns
 * the next state, or throws. The caller persists the result inside a
 * transaction with a row lock on the session; this function never touches
 * the database.
 */
export function transition(params: TransitionParams): ConsultationSessionState {
  switch (params.action) {
    case 'join':
      return join(params);
    case 'start':
      return start(params);
    case 'complete':
      return complete(params);
  }
}

function join({
  actorRole,
  now,
  appointment,
  session,
  skipJoinWindowCheck,
}: TransitionParams): ConsultationSessionState {
  if (appointment.status !== AppointmentStatus.BOOKED) {
    throw new DomainError(HttpStatus.CONFLICT, ErrorCode.APPOINTMENT_NOT_ACTIVE, 'This appointment is not active.');
  }

  const windowStart = appointment.startsAt.getTime() - JOIN_OPENS_BEFORE_MINUTES * 60_000;
  const windowEnd = appointment.endsAt.getTime() + JOIN_CLOSES_AFTER_MINUTES * 60_000;
  if (!skipJoinWindowCheck && (now.getTime() < windowStart || now.getTime() > windowEnd)) {
    throw new DomainError(
      HttpStatus.CONFLICT,
      ErrorCode.OUTSIDE_JOIN_WINDOW,
      `Joining is only allowed from ${JOIN_OPENS_BEFORE_MINUTES} minutes before the start until ${JOIN_CLOSES_AFTER_MINUTES} minutes after the end.`,
    );
  }

  const patientJoinedAt = actorRole === Role.PATIENT ? (session.patientJoinedAt ?? now) : session.patientJoinedAt;
  const doctorJoinedAt = actorRole === Role.DOCTOR ? (session.doctorJoinedAt ?? now) : session.doctorJoinedAt;
  const state = session.state === SessionState.SCHEDULED ? SessionState.JOINED : session.state;

  return { state, patientJoinedAt, doctorJoinedAt, startedAt: session.startedAt, completedAt: session.completedAt };
}

function start({ actorRole, now, session }: TransitionParams): ConsultationSessionState {
  if (actorRole !== Role.DOCTOR) {
    throw new ForbiddenException('Only the doctor can start a consultation.');
  }
  if (session.state === SessionState.IN_PROGRESS || session.state === SessionState.COMPLETED) {
    throw new DomainError(
      HttpStatus.CONFLICT,
      ErrorCode.INVALID_SESSION_TRANSITION,
      'The consultation cannot be started from its current state.',
    );
  }
  if (session.patientJoinedAt === null) {
    throw new DomainError(
      HttpStatus.CONFLICT,
      ErrorCode.PATIENT_NOT_JOINED,
      'The patient has not joined the consultation yet.',
    );
  }

  return {
    state: SessionState.IN_PROGRESS,
    patientJoinedAt: session.patientJoinedAt,
    doctorJoinedAt: session.doctorJoinedAt,
    startedAt: now,
    completedAt: session.completedAt,
  };
}

function complete({ actorRole, now, session, hasPatientSummary }: TransitionParams): ConsultationSessionState {
  if (actorRole !== Role.DOCTOR) {
    throw new ForbiddenException('Only the doctor can complete a consultation.');
  }
  if (session.state !== SessionState.IN_PROGRESS) {
    throw new DomainError(
      HttpStatus.CONFLICT,
      ErrorCode.INVALID_SESSION_TRANSITION,
      'The consultation cannot be completed from its current state.',
    );
  }
  if (!hasPatientSummary) {
    throw new DomainError(
      HttpStatus.CONFLICT,
      ErrorCode.SUMMARY_REQUIRED,
      'A patient summary is required before completing the consultation.',
    );
  }

  return {
    state: SessionState.COMPLETED,
    patientJoinedAt: session.patientJoinedAt,
    doctorJoinedAt: session.doctorJoinedAt,
    startedAt: session.startedAt,
    completedAt: now,
  };
}
