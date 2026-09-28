import { HttpStatus, NotFoundException } from '@nestjs/common';
import { AppointmentStatus, Role } from '../generated/prisma/enums.js';
import { DomainError } from '../common/errors/domain-error.js';
import { ErrorCode } from '../common/errors/error-codes.js';

export interface MessagingActor {
  id: string;
  role: Role;
}

export interface MessagingAppointment {
  patientId: string;
  doctorId: string;
  status: AppointmentStatus;
}

/**
 * The access gate for the messages module (see design.md's "Access window:
 * send while BOOKED, read while BOOKED or COMPLETED"). Non-participants get
 * 404 so existence isn't revealed, the same posture as
 * `ClinicalAccessPolicy`. Deliberately its own policy rather than reusing
 * `ClinicalAccessPolicy`: that policy allows viewing anything short of
 * `CANCELLED` (including `NOT_HELD`), while a message thread is unavailable
 * for both `CANCELLED` and `NOT_HELD`.
 */
export const MessageAccessPolicy = {
  /** Throws 404 if `actor` isn't a participant, or if the appointment is neither `BOOKED` nor `COMPLETED`. */
  assertCanRead(actor: MessagingActor, appointment: MessagingAppointment): void {
    assertParticipant(actor, appointment);
    if (appointment.status !== AppointmentStatus.BOOKED && appointment.status !== AppointmentStatus.COMPLETED) {
      throw new NotFoundException('Appointment not found');
    }
  },

  /** Throws 404 if `actor` isn't a participant, or 409 `APPOINTMENT_NOT_ACTIVE` unless the appointment is `BOOKED`. */
  assertCanSend(actor: MessagingActor, appointment: MessagingAppointment): void {
    assertParticipant(actor, appointment);
    if (appointment.status !== AppointmentStatus.BOOKED) {
      throw new DomainError(HttpStatus.CONFLICT, ErrorCode.APPOINTMENT_NOT_ACTIVE, 'This appointment is not active.');
    }
  },
};

function assertParticipant(actor: MessagingActor, appointment: MessagingAppointment): void {
  const isParticipant =
    (actor.role === Role.PATIENT && actor.id === appointment.patientId) ||
    (actor.role === Role.DOCTOR && actor.id === appointment.doctorId);
  if (!isParticipant) {
    throw new NotFoundException('Appointment not found');
  }
}
