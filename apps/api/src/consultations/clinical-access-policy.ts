import { HttpStatus, NotFoundException } from '@nestjs/common';
import { AppointmentStatus, Role, SessionState } from '../generated/prisma/enums.js';
import { DomainError } from '../common/errors/domain-error.js';
import { ErrorCode } from '../common/errors/error-codes.js';
import type { PrismaService } from '../prisma/prisma.service.js';

export interface ClinicalActor {
  id: string;
  role: Role;
}

export interface AppointmentParticipants {
  patientId: string;
  doctorId: string;
  status: AppointmentStatus;
}

/**
 * The single gate for every read/write of clinical data — notes,
 * prescriptions, workspace patient-summaries, and patient records (see
 * design.md's "Clinical access policy"). Non-participants get 404 so
 * existence isn't revealed. Administrators are excluded up front by
 * `@Roles(Role.PATIENT, Role.DOCTOR)` on every clinical HTTP route (403,
 * never reaching these checks); an `ADMIN` actor passed in here anyway
 * (e.g. from the realtime gateway, which has no `@Roles` guard) is denied
 * as "not a participant" — defense in depth, not the route the spec's 403
 * comes from.
 */
export const ClinicalAccessPolicy = {
  /** Throws 404 if `actor` isn't a participant, or 409 `APPOINTMENT_NOT_ACTIVE` if the appointment was cancelled. */
  assertCanViewWorkspace(actor: ClinicalActor, appointment: AppointmentParticipants): void {
    assertParticipant(actor, appointment);
    if (appointment.status === AppointmentStatus.CANCELLED) {
      throw new DomainError(HttpStatus.CONFLICT, ErrorCode.APPOINTMENT_NOT_ACTIVE, 'This appointment is not active.');
    }
  },

  /** True iff `actor` may currently view the workspace — used by the realtime gateway, which cannot throw HTTP exceptions into a socket ack. */
  canViewWorkspace(actor: ClinicalActor, appointment: AppointmentParticipants): boolean {
    try {
      ClinicalAccessPolicy.assertCanViewWorkspace(actor, appointment);
      return true;
    } catch {
      return false;
    }
  },

  /** Throws 404 unless `actor` is the appointment's doctor, then 409 `RECORD_LOCKED`/`SESSION_NOT_ACTIVE` depending on the session state. */
  assertCanWriteRecord(actor: ClinicalActor, appointment: AppointmentParticipants, sessionState: SessionState): void {
    if (actor.role !== Role.DOCTOR || actor.id !== appointment.doctorId) {
      throw new NotFoundException('Appointment not found');
    }
    if (sessionState === SessionState.COMPLETED) {
      throw new DomainError(HttpStatus.CONFLICT, ErrorCode.RECORD_LOCKED, 'This consultation is locked.');
    }
    if (sessionState !== SessionState.JOINED && sessionState !== SessionState.IN_PROGRESS) {
      throw new DomainError(
        HttpStatus.CONFLICT,
        ErrorCode.SESSION_NOT_ACTIVE,
        'The consultation session is not active.',
      );
    }
  },

  /** Throws 404 unless `actor` is the appointment's own patient and the consultation is `COMPLETED`. */
  assertCanPatientReadRecord(actor: ClinicalActor, appointment: AppointmentParticipants): void {
    const isOwnCompletedRecord =
      actor.role === Role.PATIENT &&
      actor.id === appointment.patientId &&
      appointment.status === AppointmentStatus.COMPLETED;
    if (!isOwnCompletedRecord) {
      throw new NotFoundException('Record not found');
    }
  },
};

function assertParticipant(actor: ClinicalActor, appointment: AppointmentParticipants): void {
  const isParticipant =
    (actor.role === Role.PATIENT && actor.id === appointment.patientId) ||
    (actor.role === Role.DOCTOR && actor.id === appointment.doctorId);
  if (!isParticipant) {
    throw new NotFoundException('Appointment not found');
  }
}

/**
 * Whether `doctorId` has (or had) a `BOOKED` or `COMPLETED` appointment with
 * `patientId` — the continuity-of-care gate for `GET /patients/{id}/record`.
 * A `CANCELLED`-only history does not establish a treating relationship.
 */
export async function hasTreatingRelationship(
  prisma: Pick<PrismaService, 'appointment'>,
  doctorId: string,
  patientId: string,
): Promise<boolean> {
  const count = await prisma.appointment.count({
    where: { doctorId, patientId, status: { in: [AppointmentStatus.BOOKED, AppointmentStatus.COMPLETED] } },
  });
  return count > 0;
}
