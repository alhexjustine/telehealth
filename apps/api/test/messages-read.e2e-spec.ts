import { afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './support/test-app.js';
import { resetDatabase } from './support/reset-db.js';
import { createAndSignInAdmin, registerDoctor, registerPatient } from './support/auth-helpers.js';
import {
  completeAppointmentDirect,
  createAppointmentDirect,
  registerBookableDoctor,
  registerBookablePatient,
} from './support/appointment-helpers.js';

describe('Reading a message thread', () => {
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

  it('Participant reads the thread', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const appointment = await createAppointmentDirect(app, {
      patientId: patient.id,
      doctorId: doctor.id,
      startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    await patient.agent.post(`/api/appointments/${appointment.id}/messages`).send({ body: 'First question' }).expect(201);
    await doctor.agent.post(`/api/appointments/${appointment.id}/messages`).send({ body: 'First reply' }).expect(201);

    const res = await doctor.agent.get(`/api/appointments/${appointment.id}/messages`).expect(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0]).toMatchObject({ senderId: patient.id, body: 'First question' });
    expect(res.body.items[1]).toMatchObject({ senderId: doctor.id, body: 'First reply' });
    expect(res.body.total).toBe(2);
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

    await otherPatient.agent.get(`/api/appointments/${appointment.id}/messages`).expect(404);
    await otherDoctor.agent.get(`/api/appointments/${appointment.id}/messages`).expect(404);
    await admin.agent.get(`/api/appointments/${appointment.id}/messages`).expect(403);
  });

  it('Thread survives completion', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const appointment = await createAppointmentDirect(app, {
      patientId: patient.id,
      doctorId: doctor.id,
      startsAt: new Date(Date.now() + 60_000),
    });
    await patient.agent.post(`/api/appointments/${appointment.id}/messages`).send({ body: 'Before the visit' }).expect(201);
    await completeAppointmentDirect(app, appointment.id);

    const res = await patient.agent.get(`/api/appointments/${appointment.id}/messages`).expect(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].body).toBe('Before the visit');
  });

  it('Thread unavailable once cancelled', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const appointment = await createAppointmentDirect(app, {
      patientId: patient.id,
      doctorId: doctor.id,
      startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: 'CANCELLED',
    });

    await patient.agent.get(`/api/appointments/${appointment.id}/messages`).expect(404);

    const notHeld = await createAppointmentDirect(app, {
      patientId: patient.id,
      doctorId: doctor.id,
      startsAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      status: 'NOT_HELD',
    });
    await patient.agent.get(`/api/appointments/${notHeld.id}/messages`).expect(404);
  });

  it('Fallback without a live connection', async () => {
    // No socket is opened in this test at all: the message is sent and read
    // entirely over plain HTTP, exercising the same code path a client falls
    // back to when a live connection can't be established.
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const appointment = await createAppointmentDirect(app, {
      patientId: patient.id,
      doctorId: doctor.id,
      startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    await patient.agent.post(`/api/appointments/${appointment.id}/messages`).send({ body: 'Sent while offline' }).expect(201);

    const res = await doctor.agent.get(`/api/appointments/${appointment.id}/messages`).expect(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].body).toBe('Sent while offline');
  });
});
