import { afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './support/test-app.js';
import { resetDatabase } from './support/reset-db.js';
import { registerBookableDoctor, registerBookablePatient } from './support/appointment-helpers.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { AppointmentStatus, NotificationType } from '../src/generated/prisma/enums.js';
import { ReminderService } from '../src/notifications/reminder.service.js';

describe('Upcoming appointment reminders', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let reminderService: ReminderService;

  beforeAll(async () => {
    await resetDatabase();
  });

  beforeEach(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    reminderService = app.get(ReminderService);
  });

  afterEach(async () => {
    await app.close();
  });

  /** Inserts a booked (or given-status) appointment directly, with explicit `startsAt`/`createdAt` the booking API can't express. */
  async function insertAppointment(params: {
    doctorId: string;
    patientId: string;
    startsAt: Date;
    createdAt: Date;
    status?: AppointmentStatus;
  }) {
    return prisma.appointment.create({
      data: {
        doctorId: params.doctorId,
        patientId: params.patientId,
        startsAt: params.startsAt,
        endsAt: new Date(params.startsAt.getTime() + 30 * 60_000),
        reason: 'A valid ten-plus character reason',
        status: params.status ?? AppointmentStatus.BOOKED,
        createdAt: params.createdAt,
      },
    });
  }

  it('24-hour reminder', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const now = new Date();
    const appointment = await insertAppointment({
      doctorId: doctor.id,
      patientId: patient.id,
      startsAt: new Date(now.getTime() + (24 * 60 - 2) * 60_000), // 23h58m away
      createdAt: new Date(now.getTime() - 3 * 24 * 3_600_000), // booked 3 days ago
    });

    await reminderService.run(now);

    const reminders = await prisma.notification.findMany({
      where: { appointmentId: appointment.id, type: NotificationType.REMINDER_24H },
    });
    expect(reminders).toHaveLength(2);
    expect(reminders.map((r) => r.userId).sort()).toEqual([doctor.id, patient.id].sort());
    expect(reminders.every((r) => r.title === 'Starts in 24 hours')).toBe(true);
  });

  it('1-hour reminder', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const now = new Date();
    const appointment = await insertAppointment({
      doctorId: doctor.id,
      patientId: patient.id,
      startsAt: new Date(now.getTime() + 58 * 60_000), // 58 minutes away
      createdAt: new Date(now.getTime() - 3 * 24 * 3_600_000),
    });

    await reminderService.run(now);

    const reminders = await prisma.notification.findMany({
      where: { appointmentId: appointment.id, type: NotificationType.REMINDER_1H },
    });
    expect(reminders).toHaveLength(2);
    expect(reminders.map((r) => r.userId).sort()).toEqual([doctor.id, patient.id].sort());
    expect(reminders.every((r) => r.title === 'Starts in 1 hour')).toBe(true);
  });

  it('No duplicates', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const now = new Date();
    const appointment = await insertAppointment({
      doctorId: doctor.id,
      patientId: patient.id,
      startsAt: new Date(now.getTime() + 58 * 60_000),
      createdAt: new Date(now.getTime() - 3 * 24 * 3_600_000),
    });

    await reminderService.run(now);
    await reminderService.run(new Date(now.getTime() + 60_000));
    await reminderService.run(new Date(now.getTime() + 120_000));

    const reminders = await prisma.notification.findMany({
      where: { appointmentId: appointment.id, type: NotificationType.REMINDER_1H },
    });
    expect(reminders).toHaveLength(2);
  });

  it('Cancelled appointment', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const now = new Date();
    const appointment = await insertAppointment({
      doctorId: doctor.id,
      patientId: patient.id,
      startsAt: new Date(now.getTime() + 58 * 60_000),
      createdAt: new Date(now.getTime() - 3 * 24 * 3_600_000),
      status: AppointmentStatus.CANCELLED,
    });

    await reminderService.run(now);

    const reminders = await prisma.notification.findMany({ where: { appointmentId: appointment.id } });
    expect(reminders).toHaveLength(0);
  });

  it('Short-notice booking', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const now = new Date();
    const appointment = await insertAppointment({
      doctorId: doctor.id,
      patientId: patient.id,
      startsAt: new Date(now.getTime() + 3 * 3_600_000), // starts in 3 hours
      createdAt: now, // booked just now
    });

    await reminderService.run(now);
    const afterBooking = await prisma.notification.findMany({ where: { appointmentId: appointment.id } });
    expect(afterBooking).toHaveLength(0); // no 24h reminder, and it's not within the 1h window yet

    // Once the 1-hour window opens, the reminder is still created.
    const oneHourLater = new Date(now.getTime() + 2 * 3_600_000 + 5 * 60_000); // 55 minutes before start
    await reminderService.run(oneHourLater);
    const reminders = await prisma.notification.findMany({
      where: { appointmentId: appointment.id, type: NotificationType.REMINDER_1H },
    });
    expect(reminders).toHaveLength(2);
    const stale24h = await prisma.notification.findMany({
      where: { appointmentId: appointment.id, type: NotificationType.REMINDER_24H },
    });
    expect(stale24h).toHaveLength(0);
  });
});
