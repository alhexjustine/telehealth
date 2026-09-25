import { describe, expect, it } from '@jest/globals';
import { NotificationType } from '../generated/prisma/enums.js';
import {
  bookNotificationDrafts,
  cancelNotificationDrafts,
  rescheduleNotificationDrafts,
} from './appointment-notifications.js';

const doctor = { id: 'doctor-1', displayName: 'Grace Hopper' };
const patient = { id: 'patient-1', displayName: 'Ada Lovelace' };

describe('bookNotificationDrafts', () => {
  it('notifies the doctor and confirms to the patient', () => {
    const startsAt = new Date('2026-10-01T09:00:00.000Z');
    const drafts = bookNotificationDrafts({ appointmentId: 'appt-1', doctor, patient, startsAt });

    expect(drafts).toHaveLength(2);
    const doctorDraft = drafts.find((d) => d.userId === doctor.id)!;
    const patientDraft = drafts.find((d) => d.userId === patient.id)!;

    expect(doctorDraft.type).toBe(NotificationType.APPOINTMENT_BOOKED);
    expect(doctorDraft.title).toBe('New booking');
    expect(doctorDraft.body).toContain(patient.displayName);
    expect(doctorDraft.link).toBe('/doctor/appointments/appt-1');
    expect(doctorDraft.appointmentId).toBe('appt-1');
    expect(doctorDraft.data).toMatchObject({ startsAt: startsAt.toISOString(), counterpartName: patient.displayName });

    expect(patientDraft.type).toBe(NotificationType.BOOKING_CONFIRMED);
    expect(patientDraft.title).toBe('Booking confirmed');
    expect(patientDraft.body).toContain(doctor.displayName);
    expect(patientDraft.link).toBe('/patient/appointments/appt-1');
  });
});

describe('rescheduleNotificationDrafts', () => {
  it('notifies the doctor with old and new times and confirms to the patient', () => {
    const startsAt = new Date('2026-10-02T09:00:00.000Z');
    const previousStartsAt = new Date('2026-10-01T09:00:00.000Z');
    const drafts = rescheduleNotificationDrafts({
      newAppointmentId: 'appt-2',
      doctor,
      patient,
      startsAt,
      previousStartsAt,
    });

    expect(drafts).toHaveLength(2);
    const doctorDraft = drafts.find((d) => d.userId === doctor.id)!;
    const patientDraft = drafts.find((d) => d.userId === patient.id)!;

    expect(doctorDraft.type).toBe(NotificationType.APPOINTMENT_RESCHEDULED);
    expect(doctorDraft.data).toMatchObject({
      startsAt: startsAt.toISOString(),
      previousStartsAt: previousStartsAt.toISOString(),
    });
    expect(doctorDraft.link).toBe('/doctor/appointments/appt-2');

    expect(patientDraft.type).toBe(NotificationType.RESCHEDULE_CONFIRMED);
    expect(patientDraft.link).toBe('/patient/appointments/appt-2');
  });

  it('does not emit a cancellation notification', () => {
    const drafts = rescheduleNotificationDrafts({
      newAppointmentId: 'appt-2',
      doctor,
      patient,
      startsAt: new Date(),
      previousStartsAt: new Date(),
    });

    expect(drafts.some((d) => d.type === NotificationType.APPOINTMENT_CANCELLED)).toBe(false);
  });
});

describe('cancelNotificationDrafts', () => {
  it('notifies only the patient when the doctor cancels, naming the doctor and the reason', () => {
    const drafts = cancelNotificationDrafts({
      appointmentId: 'appt-3',
      doctor,
      patient,
      cancelledById: doctor.id,
      cancellationReason: 'Unexpected emergency',
    });

    expect(drafts).toHaveLength(1);
    const draft = drafts[0]!;
    expect(draft.userId).toBe(patient.id);
    expect(draft.type).toBe(NotificationType.APPOINTMENT_CANCELLED);
    expect(draft.body).toContain('Grace Hopper');
    expect(draft.body).toContain('Unexpected emergency');
    expect(draft.link).toBe('/patient/appointments/appt-3');
  });

  it('notifies only the doctor when the patient cancels, with no reason required', () => {
    const drafts = cancelNotificationDrafts({
      appointmentId: 'appt-4',
      doctor,
      patient,
      cancelledById: patient.id,
      cancellationReason: null,
    });

    expect(drafts).toHaveLength(1);
    const draft = drafts[0]!;
    expect(draft.userId).toBe(doctor.id);
    expect(draft.body).not.toContain(':');
    expect(draft.link).toBe('/doctor/appointments/appt-4');
  });
});
