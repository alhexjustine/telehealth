import { afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from './support/test-app.js';
import { resetDatabase } from './support/reset-db.js';
import { createAndSignInAdmin } from './support/auth-helpers.js';
import {
  completeAppointmentDirect,
  createAppointmentDirect,
  registerBookableDoctor,
  registerBookablePatient,
} from './support/appointment-helpers.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

async function completeConsultation(
  app: INestApplication,
  patient: Awaited<ReturnType<typeof registerBookablePatient>>,
  doctor: Awaited<ReturnType<typeof registerBookableDoctor>>,
  startsAt: Date,
  patientSummary = 'You have a mild cold; rest and hydrate.',
): Promise<{ id: string }> {
  const appointment = await createAppointmentDirect(app, { patientId: patient.id, doctorId: doctor.id, startsAt });
  await patient.agent.post(`/api/consultations/${appointment.id}/join`).expect(200);
  await doctor.agent.post(`/api/consultations/${appointment.id}/start`).expect(200);
  const prisma = app.get(PrismaService);
  await prisma.consultationNote.create({ data: { appointmentId: appointment.id, patientSummary } });
  await doctor.agent.post(`/api/consultations/${appointment.id}/complete`).expect(200);
  return appointment;
}

describe('Patient access to own records', () => {
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

  it('Patient lists records', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);

    // Two already-completed consultations at different times (fixture data,
    // via `completeAppointmentDirect` — the completion flow itself is
    // covered by consultations-session.e2e-spec.ts), plus one upcoming
    // appointment that must not appear in the list.
    const first = await createAppointmentDirect(app, {
      patientId: patient.id,
      doctorId: doctor.id,
      startsAt: new Date(Date.now() + 60_000),
    });
    await completeAppointmentDirect(app, first.id, 'First visit summary');
    const second = await createAppointmentDirect(app, {
      patientId: patient.id,
      doctorId: doctor.id,
      startsAt: new Date(Date.now() + 2 * 60 * 60_000),
    });
    await completeAppointmentDirect(app, second.id, 'Second visit summary');
    await createAppointmentDirect(app, {
      patientId: patient.id,
      doctorId: doctor.id,
      startsAt: new Date(Date.now() + 4 * 60 * 60_000),
    });

    const res = await patient.agent.get('/api/records');
    expect(res.status).toBe(200);
    expect(res.body.items.map((i: { appointmentId: string }) => i.appointmentId)).toEqual([second.id, first.id]);
    expect(res.body.total).toBe(2);
  });

  it('Draft not visible to patient', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const appointment = await createAppointmentDirect(app, {
      patientId: patient.id,
      doctorId: doctor.id,
      startsAt: new Date(Date.now() + 60_000),
    });
    await patient.agent.post(`/api/consultations/${appointment.id}/join`).expect(200);
    await doctor.agent.post(`/api/consultations/${appointment.id}/start`).expect(200);

    const res = await patient.agent.get(`/api/records/${appointment.id}`);
    expect(res.status).toBe(404);
  });

  it("Another patient's record", async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const otherPatient = await registerBookablePatient(app);
    const appointment = await completeConsultation(app, patient, doctor, new Date(Date.now() + 60_000));

    const res = await otherPatient.agent.get(`/api/records/${appointment.id}`);
    expect(res.status).toBe(404);
  });

  it('shows the note fields and prescriptions of a completed consultation', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const appointment = await completeConsultation(app, patient, doctor, new Date(Date.now() + 60_000), 'Rest well.');

    const res = await patient.agent.get(`/api/records/${appointment.id}`);
    expect(res.status).toBe(200);
    expect(res.body.note.patientSummary).toBe('Rest well.');
    expect(Array.isArray(res.body.prescriptions)).toBe(true);
  });
});

describe('Doctor access to patient records', () => {
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

  it('Treating doctor views the record', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    await createAppointmentDirect(app, {
      patientId: patient.id,
      doctorId: doctor.id,
      startsAt: new Date(Date.now() + 24 * 60 * 60_000),
    });

    const res = await doctor.agent.get(`/api/patients/${patient.id}/record`);
    expect(res.status).toBe(200);
    expect(res.body.patientId).toBe(patient.id);
    expect(res.body.appointmentsWithDoctor).toHaveLength(1);
  });

  it('No treating relationship', async () => {
    const doctor = await registerBookableDoctor(app);
    const strangerDoctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const cancelOnlyPatient = await registerBookablePatient(app);

    // Never had any appointment with `doctor`.
    const neverRes = await doctor.agent.get(`/api/patients/${patient.id}/record`);
    expect(neverRes.status).toBe(404);

    // Only a cancelled appointment with `strangerDoctor`.
    const appointment = await createAppointmentDirect(app, {
      patientId: cancelOnlyPatient.id,
      doctorId: strangerDoctor.id,
      startsAt: new Date(Date.now() + 24 * 60 * 60_000),
      status: 'CANCELLED',
    });
    const cancelOnlyRes = await strangerDoctor.agent.get(`/api/patients/${cancelOnlyPatient.id}/record`);
    expect(cancelOnlyRes.status).toBe(404);
    expect(appointment.id).toBeDefined();
  });
});

describe('No administrator access to clinical content', () => {
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

  it('Administrator requests clinical data', async () => {
    const doctor = await registerBookableDoctor(app);
    const patient = await registerBookablePatient(app);
    const admin = await createAndSignInAdmin(app);
    const appointment = await completeConsultation(app, patient, doctor, new Date(Date.now() + 60_000));

    expect((await admin.agent.get('/api/records')).status).toBe(403);
    expect((await admin.agent.get(`/api/records/${appointment.id}`)).status).toBe(403);
    expect((await admin.agent.get(`/api/patients/${patient.id}/record`)).status).toBe(403);
    expect((await admin.agent.get(`/api/consultations/${appointment.id}`)).status).toBe(403);
    expect(
      (await admin.agent.put(`/api/consultations/${appointment.id}/note`).send({ findings: 'x' })).status,
    ).toBe(403);
    expect(
      (
        await admin.agent
          .post(`/api/consultations/${appointment.id}/prescriptions`)
          .send({ medication: 'x', dosage: 'x', frequency: 'x', duration: 'x' })
      ).status,
    ).toBe(403);
  });
});
