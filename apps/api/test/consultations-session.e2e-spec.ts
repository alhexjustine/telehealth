import { afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './support/test-app.js';
import { resetDatabase } from './support/reset-db.js';
import { createAppointmentDirect, registerBookableDoctor, registerBookablePatient } from './support/appointment-helpers.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { NotificationsService } from '../src/notifications/notifications.service.js';

describe('Starting and completing', () => {
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

  it('Doctor starts after the patient joins', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const startsAt = new Date(Date.now() + 1 * 60_000);
    const appointment = await createAppointmentDirect(app, { patientId: patient.id, doctorId: doctor.id, startsAt });

    await patient.agent.post(`/api/consultations/${appointment.id}/join`).expect(200);
    const res = await doctor.agent.post(`/api/consultations/${appointment.id}/start`);
    expect(res.status).toBe(200);
    expect(res.body.state).toBe('IN_PROGRESS');
    expect(res.body.startedAt).not.toBeNull();
  });

  it('Patient not yet joined', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const startsAt = new Date(Date.now() + 1 * 60_000);
    const appointment = await createAppointmentDirect(app, { patientId: patient.id, doctorId: doctor.id, startsAt });

    await doctor.agent.post(`/api/consultations/${appointment.id}/join`).expect(200);
    const res = await doctor.agent.post(`/api/consultations/${appointment.id}/start`);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PATIENT_NOT_JOINED');
  });

  it('Complete with summary', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const startsAt = new Date(Date.now() + 1 * 60_000);
    const appointment = await createAppointmentDirect(app, { patientId: patient.id, doctorId: doctor.id, startsAt });

    await patient.agent.post(`/api/consultations/${appointment.id}/join`).expect(200);
    await doctor.agent.post(`/api/consultations/${appointment.id}/start`).expect(200);

    const prisma = app.get(PrismaService);
    await prisma.consultationNote.create({
      data: { appointmentId: appointment.id, patientSummary: 'You have a mild cold; rest and hydrate.' },
    });

    const res = await doctor.agent.post(`/api/consultations/${appointment.id}/complete`);
    expect(res.status).toBe(200);
    expect(res.body.state).toBe('COMPLETED');
    expect(res.body.completedAt).not.toBeNull();

    const updatedAppointment = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    expect(updatedAppointment.status).toBe('COMPLETED');
  });

  it('Complete without summary', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const startsAt = new Date(Date.now() + 1 * 60_000);
    const appointment = await createAppointmentDirect(app, { patientId: patient.id, doctorId: doctor.id, startsAt });

    await patient.agent.post(`/api/consultations/${appointment.id}/join`).expect(200);
    await doctor.agent.post(`/api/consultations/${appointment.id}/start`).expect(200);

    const res = await doctor.agent.post(`/api/consultations/${appointment.id}/complete`);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SUMMARY_REQUIRED');

    const prisma = app.get(PrismaService);
    const session = await prisma.consultationSession.findUniqueOrThrow({ where: { appointmentId: appointment.id } });
    expect(session.state).toBe('IN_PROGRESS');
  });

  it('Invalid transition', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const startsAt = new Date(Date.now() + 1 * 60_000);

    // Start a consultation whose session is only JOINED, and try to complete it.
    const joinedOnly = await createAppointmentDirect(app, { patientId: patient.id, doctorId: doctor.id, startsAt });
    await patient.agent.post(`/api/consultations/${joinedOnly.id}/join`).expect(200);
    const completeJoinedOnly = await doctor.agent.post(`/api/consultations/${joinedOnly.id}/complete`);
    expect(completeJoinedOnly.status).toBe(409);
    expect(completeJoinedOnly.body.code).toBe('INVALID_SESSION_TRANSITION');

    // Try to start an already-completed consultation. A second doctor/patient
    // pair avoids colliding with `joinedOnly`'s exclusion constraints at the
    // same `startsAt`.
    const doctor2 = await registerBookableDoctor(app);
    const patient2 = await registerBookablePatient(app);
    const completedAppt = await createAppointmentDirect(app, {
      patientId: patient2.id,
      doctorId: doctor2.id,
      startsAt,
    });
    await patient2.agent.post(`/api/consultations/${completedAppt.id}/join`).expect(200);
    await doctor2.agent.post(`/api/consultations/${completedAppt.id}/start`).expect(200);
    const prisma = app.get(PrismaService);
    await prisma.consultationNote.create({
      data: { appointmentId: completedAppt.id, patientSummary: 'All good.' },
    });
    await doctor2.agent.post(`/api/consultations/${completedAppt.id}/complete`).expect(200);
    const startCompleted = await doctor2.agent.post(`/api/consultations/${completedAppt.id}/start`);
    expect(startCompleted.status).toBe(409);
    expect(startCompleted.body.code).toBe('INVALID_SESSION_TRANSITION');
  });

  it('Patient cannot control the session', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const startsAt = new Date(Date.now() + 1 * 60_000);
    const appointment = await createAppointmentDirect(app, { patientId: patient.id, doctorId: doctor.id, startsAt });

    await patient.agent.post(`/api/consultations/${appointment.id}/join`).expect(200);

    const startRes = await patient.agent.post(`/api/consultations/${appointment.id}/start`);
    expect(startRes.status).toBe(403);

    const completeRes = await patient.agent.post(`/api/consultations/${appointment.id}/complete`);
    expect(completeRes.status).toBe(403);
  });

  it('Patient notified on completion', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const startsAt = new Date(Date.now() + 1 * 60_000);
    const appointment = await createAppointmentDirect(app, { patientId: patient.id, doctorId: doctor.id, startsAt });

    await patient.agent.post(`/api/consultations/${appointment.id}/join`).expect(200);
    await doctor.agent.post(`/api/consultations/${appointment.id}/start`).expect(200);

    const prisma = app.get(PrismaService);
    await prisma.consultationNote.create({
      data: { appointmentId: appointment.id, patientSummary: 'You have a mild cold; rest and hydrate.' },
    });
    await doctor.agent.post(`/api/consultations/${appointment.id}/complete`).expect(200);

    const notificationsService = app.get(NotificationsService);
    const patientNotifications = await notificationsService.list(patient.id, { unreadOnly: false, page: 1, pageSize: 20 });
    const summaryNotifications = patientNotifications.items.filter((n) => n.type === 'CONSULTATION_SUMMARY_AVAILABLE');
    expect(summaryNotifications).toHaveLength(1);
    expect(summaryNotifications[0]?.readAt).toBeNull();
    expect(summaryNotifications[0]?.link).toBe(`/patient/records/${appointment.id}`);

    const doctorNotifications = await notificationsService.list(doctor.id, { unreadOnly: false, page: 1, pageSize: 20 });
    expect(doctorNotifications.items.filter((n) => n.type === 'CONSULTATION_SUMMARY_AVAILABLE')).toHaveLength(0);
  });
});
