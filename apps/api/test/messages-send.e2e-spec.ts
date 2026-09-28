import { afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './support/test-app.js';
import { resetDatabase } from './support/reset-db.js';
import { createAndSignInAdmin, registerDoctor, registerPatient } from './support/auth-helpers.js';
import { createAppointmentDirect, registerBookableDoctor, registerBookablePatient } from './support/appointment-helpers.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Sending a message', () => {
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

  it('Patient sends a message', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const appointment = await createAppointmentDirect(app, {
      patientId: patient.id,
      doctorId: doctor.id,
      startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const res = await patient.agent
      .post(`/api/appointments/${appointment.id}/messages`)
      .send({ body: 'What time should I take the medication?' })
      .expect(201);

    expect(res.body.senderId).toBe(patient.id);
    expect(res.body.appointmentId).toBe(appointment.id);
    expect(res.body.body).toBe('What time should I take the medication?');
    expect(typeof res.body.id).toBe('string');
    expect(typeof res.body.createdAt).toBe('string');
  });

  it('Empty body rejected', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const appointment = await createAppointmentDirect(app, {
      patientId: patient.id,
      doctorId: doctor.id,
      startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const whitespaceOnly = await patient.agent
      .post(`/api/appointments/${appointment.id}/messages`)
      .send({ body: '   ' })
      .expect(400);
    expect(whitespaceOnly.status).toBe(400);

    const prisma = app.get(PrismaService);
    const count = await prisma.message.count({ where: { appointmentId: appointment.id } });
    expect(count).toBe(0);
  });

  it('Body too long', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const appointment = await createAppointmentDirect(app, {
      patientId: patient.id,
      doctorId: doctor.id,
      startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    await patient.agent
      .post(`/api/appointments/${appointment.id}/messages`)
      .send({ body: 'a'.repeat(2001) })
      .expect(400);

    const prisma = app.get(PrismaService);
    const count = await prisma.message.count({ where: { appointmentId: appointment.id } });
    expect(count).toBe(0);
  });

  it('Non-participant denied', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const otherPatient = await registerPatient(app);
    const otherDoctor = await registerDoctor(app);
    const admin = await createAndSignInAdmin(app);
    const appointment = await createAppointmentDirect(app, {
      patientId: patient.id,
      doctorId: doctor.id,
      startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    await otherPatient.agent
      .post(`/api/appointments/${appointment.id}/messages`)
      .send({ body: 'Hello' })
      .expect(404);
    await otherDoctor.agent
      .post(`/api/appointments/${appointment.id}/messages`)
      .send({ body: 'Hello' })
      .expect(404);
    await admin.agent
      .post(`/api/appointments/${appointment.id}/messages`)
      .send({ body: 'Hello' })
      .expect(403);

    const prisma = app.get(PrismaService);
    const count = await prisma.message.count({ where: { appointmentId: appointment.id } });
    expect(count).toBe(0);
  });

  it('Appointment not booked', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const appointment = await createAppointmentDirect(app, {
      patientId: patient.id,
      doctorId: doctor.id,
      startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: 'CANCELLED',
    });

    const res = await patient.agent
      .post(`/api/appointments/${appointment.id}/messages`)
      .send({ body: 'Are we still on?' })
      .expect(409);
    expect(res.body.code).toBe('APPOINTMENT_NOT_ACTIVE');

    const prisma = app.get(PrismaService);
    const count = await prisma.message.count({ where: { appointmentId: appointment.id } });
    expect(count).toBe(0);
  });

  it('Rate limit exceeded', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const appointment = await createAppointmentDirect(app, {
      patientId: patient.id,
      doctorId: doctor.id,
      startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    for (let i = 0; i < 20; i += 1) {
      await patient.agent
        .post(`/api/appointments/${appointment.id}/messages`)
        .send({ body: `Message number ${i}` })
        .expect(201);
    }

    const overLimit = await patient.agent
      .post(`/api/appointments/${appointment.id}/messages`)
      .send({ body: 'One too many' });
    expect(overLimit.status).toBe(429);

    const prisma = app.get(PrismaService);
    const count = await prisma.message.count({ where: { appointmentId: appointment.id } });
    expect(count).toBe(20);
  });

  it('Recipient notified', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const appointment = await createAppointmentDirect(app, {
      patientId: patient.id,
      doctorId: doctor.id,
      startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    await patient.agent
      .post(`/api/appointments/${appointment.id}/messages`)
      .send({ body: 'Quick question about my prescription' })
      .expect(201);

    const doctorNotifications = await doctor.agent.get('/api/notifications').expect(200);
    const newMessageNotifications = doctorNotifications.body.items.filter((item: { type: string }) => item.type === 'NEW_MESSAGE');
    expect(newMessageNotifications).toHaveLength(1);
    expect(newMessageNotifications[0].readAt).toBeNull();
    expect(newMessageNotifications[0].appointmentId).toBe(appointment.id);
    expect(newMessageNotifications[0].body as string).not.toContain('Quick question about my prescription');

    const patientNotifications = await patient.agent.get('/api/notifications').expect(200);
    expect(patientNotifications.body.items.filter((item: { type: string }) => item.type === 'NEW_MESSAGE')).toHaveLength(0);
  });

  it('Failed send creates nothing', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const appointment = await createAppointmentDirect(app, {
      patientId: patient.id,
      doctorId: doctor.id,
      startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: 'CANCELLED',
    });

    await patient.agent
      .post(`/api/appointments/${appointment.id}/messages`)
      .send({ body: 'Are we still on?' })
      .expect(409);

    const doctorNotifications = await doctor.agent.get('/api/notifications').expect(200);
    expect(doctorNotifications.body.items.filter((item: { type: string }) => item.type === 'NEW_MESSAGE')).toHaveLength(0);
  });
});
