import { afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './support/test-app.js';
import { resetDatabase } from './support/reset-db.js';
import { registerBookableDoctor, registerBookablePatient, nextSlotStart } from './support/appointment-helpers.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { NotificationType } from '../src/generated/prisma/enums.js';
import { NotificationsService } from '../src/notifications/notifications.service.js';
import { withNotifications } from '../src/notifications/with-notifications.js';

/** A slot at least `days` days out, at the aligned half-hour boundary `giveFullWeekAvailability` offers. */
function slotDaysOut(days: number): Date {
  const target = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const stepMs = 30 * 60_000;
  return new Date(Math.ceil(target.getTime() / stepMs) * stepMs);
}

describe('Appointment event notifications', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await resetDatabase();
  });

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('Booking notifies both', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const start = nextSlotStart(new Date());

    const booked = await patient.agent
      .post('/api/appointments')
      .send({ doctorId: doctor.id, startsAt: start.toISOString(), reason: 'A valid ten-plus character reason' })
      .expect(201);

    const prisma = app.get(PrismaService);
    const doctorNotifications = await prisma.notification.findMany({ where: { userId: doctor.id } });
    const patientNotifications = await prisma.notification.findMany({ where: { userId: patient.id } });

    expect(doctorNotifications).toHaveLength(1);
    expect(doctorNotifications[0]!.type).toBe(NotificationType.APPOINTMENT_BOOKED);
    expect(doctorNotifications[0]!.readAt).toBeNull();
    expect(doctorNotifications[0]!.appointmentId).toBe(booked.body.id);

    expect(patientNotifications).toHaveLength(1);
    expect(patientNotifications[0]!.type).toBe(NotificationType.BOOKING_CONFIRMED);
    expect(patientNotifications[0]!.readAt).toBeNull();
    expect(patientNotifications[0]!.appointmentId).toBe(booked.body.id);
  });

  it('Reschedule notifies both', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const originalStart = slotDaysOut(2);

    const booked = await patient.agent
      .post('/api/appointments')
      .send({ doctorId: doctor.id, startsAt: originalStart.toISOString(), reason: 'Original booking' })
      .expect(201);

    const newStart = slotDaysOut(3);
    const rescheduled = await patient.agent
      .post(`/api/appointments/${booked.body.id}/reschedule`)
      .send({ startsAt: newStart.toISOString() })
      .expect(201);

    const prisma = app.get(PrismaService);
    const doctorNotifications = await prisma.notification.findMany({
      where: { userId: doctor.id, appointmentId: rescheduled.body.id },
    });
    const patientNotifications = await prisma.notification.findMany({
      where: { userId: patient.id, appointmentId: rescheduled.body.id },
    });

    expect(doctorNotifications).toHaveLength(1);
    expect(doctorNotifications[0]!.type).toBe(NotificationType.APPOINTMENT_RESCHEDULED);
    const doctorData = doctorNotifications[0]!.data as { startsAt: string; previousStartsAt: string };
    expect(doctorData.startsAt).toBe(newStart.toISOString());
    expect(doctorData.previousStartsAt).toBe(originalStart.toISOString());

    expect(patientNotifications).toHaveLength(1);
    expect(patientNotifications[0]!.type).toBe(NotificationType.RESCHEDULE_CONFIRMED);

    // The old appointment's internal cancel must not have created a cancellation notification.
    const cancellationNotifications = await prisma.notification.findMany({
      where: { type: NotificationType.APPOINTMENT_CANCELLED, appointmentId: booked.body.id },
    });
    expect(cancellationNotifications).toHaveLength(0);
  });

  it('Cancellation notifies the other participant', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const start = nextSlotStart(new Date());

    const booked = await patient.agent
      .post('/api/appointments')
      .send({ doctorId: doctor.id, startsAt: start.toISOString(), reason: 'A valid ten-plus character reason' })
      .expect(201);

    await doctor.agent
      .post(`/api/appointments/${booked.body.id}/cancel`)
      .send({ reason: 'Unexpected emergency' })
      .expect(200);

    const prisma = app.get(PrismaService);
    const patientNotifications = await prisma.notification.findMany({
      where: { userId: patient.id, type: NotificationType.APPOINTMENT_CANCELLED },
    });
    expect(patientNotifications).toHaveLength(1);
    expect(patientNotifications[0]!.body).toContain('Unexpected emergency');
    expect(patientNotifications[0]!.body).toContain('Grace Hopper'); // registerDoctor's default name
    expect(patientNotifications[0]!.link).toBe(`/patient/appointments/${booked.body.id}`);

    const doctorNotifications = await prisma.notification.findMany({
      where: { userId: doctor.id, type: NotificationType.APPOINTMENT_CANCELLED },
    });
    expect(doctorNotifications).toHaveLength(0);
  });

  it('Failed event creates nothing', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);

    // Less than the booking horizon's lead time -> SLOT_UNAVAILABLE, per `appointments-book.e2e-spec.ts`.
    const res = await patient.agent.post('/api/appointments').send({
      doctorId: doctor.id,
      startsAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      reason: 'A valid ten-plus character reason',
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SLOT_UNAVAILABLE');

    const prisma = app.get(PrismaService);
    const count = await prisma.notification.count({
      where: { OR: [{ userId: doctor.id }, { userId: patient.id }] },
    });
    expect(count).toBe(0);
  });

  it('Atomicity: a forced rollback after staging leaves no notification rows', async () => {
    const patient = await registerBookablePatient(app);
    const prisma = app.get(PrismaService);
    const notificationsService = app.get(NotificationsService);

    await expect(
      withNotifications(prisma, notificationsService, async (_tx, notify) => {
        await notify([
          { userId: patient.id, type: NotificationType.BOOKING_CONFIRMED, title: 'Booking confirmed', body: 'x' },
        ]);
        throw new Error('forced rollback for the atomicity test');
      }),
    ).rejects.toThrow('forced rollback for the atomicity test');

    const count = await prisma.notification.count({ where: { userId: patient.id } });
    expect(count).toBe(0);
  });
});
